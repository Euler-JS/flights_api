const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('rate-limiter-flexible');
const Amadeus = require('amadeus');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// ====================================
// CONFIGURAÇÃO AMADEUS
// ====================================

const amadeus = new Amadeus({
    clientId: process.env.AMADEUS_CLIENT_ID,
    clientSecret: process.env.AMADEUS_CLIENT_SECRET,
    hostname: process.env.NODE_ENV === 'production' 
        ? 'production' 
        : 'test' // Ambiente de teste
});

// ====================================
// MIDDLEWARES
// ====================================
console.log('Inicializando middlewares...', process.env.FRONTEND_URL); ;
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());

// Rate limiting
const rateLimiter = new rateLimit.RateLimiterMemory({
    keyPrefix: 'flight_search',
    points: 50, // 50 requests
    duration: 3600, // per hour
});

// ====================================
// ROTAS DA API
// ====================================

// 1. Buscar Voos
app.post('/api/flights/search', async (req, res) => {
    try {
        await rateLimiter.consume(req.ip);

        const {
            origin,
            destination,
            departureDate,
            returnDate,
            adults = 1,
            children = 0,
            infants = 0,
            travelClass = 'ECONOMY',
            maxResults = 50
        } = req.body;

        console.log('Parâmetros de busca:', origin, destination, departureDate);
        // Validações
        if (!origin || !destination || !departureDate) {
            return res.status(400).json({
                error: 'Origem, destino e data de partida são obrigatórios'
            });
        }

        const searchParams = {
            originLocationCode: origin,
            destinationLocationCode: destination,
            departureDate: departureDate,
            adults: adults,
            children: children,
            infants: infants,
            travelClass: travelClass,
            currencyCode: 'BRL',
            max: maxResults
        };

        if (returnDate) {
            searchParams.returnDate = returnDate;
        }

        const response = await amadeus.shopping.flightOffersSearch.get(searchParams);
        
        // Formatar resultados
        const formattedFlights = formatFlightOffers(response.data);

        res.json({
            success: true,
            data: formattedFlights,
            meta: {
                count: formattedFlights.length,
                searchParams: searchParams
            }
        });

    } catch (error) {
        console.error('Erro na busca de voos:', error);

        if (error.code === 'RATE_LIMIT_EXCEEDED') {
            return res.status(429).json({
                error: 'Muitas requisições. Tente novamente em alguns minutos.'
            });
        }

        res.status(500).json({
            error: 'Erro interno do servidor',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 2. Buscar Aeroportos/Cidades
app.get('/api/locations/search', async (req, res) => {
    try {
        const { keyword } = req.query;

        if (!keyword || keyword.length < 3) {
            return res.status(400).json({
                error: 'Palavra-chave deve ter pelo menos 3 caracteres'
            });
        }

        const response = await amadeus.referenceData.locations.get({
            keyword: keyword,
            subType: Amadeus.location.airport
        });

        const formattedLocations = response.data.map(location => ({
            iataCode: location.iataCode,
            name: location.name,
            city: location.address.cityName,
            country: location.address.countryName,
            timezone: location.timeZoneOffset
        }));

        res.json({
            success: true,
            data: formattedLocations
        });

    } catch (error) {
        console.error('Erro na busca de aeroportos:', error);
        res.status(500).json({
            error: 'Erro ao buscar aeroportos'
        });
    }
});

// 3. Confirmar Preço do Voo
app.post('/api/flights/price-confirm', async (req, res) => {
    try {
        const { flightOffer } = req.body;

        if (!flightOffer) {
            return res.status(400).json({
                error: 'Dados do voo são obrigatórios'
            });
        }

        const response = await amadeus.shopping.flightOffers.pricing.post({
            data: {
                type: 'flight-offers-pricing',
                flightOffers: [flightOffer]
            }
        });

        res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('Erro na confirmação de preço:', error);
        res.status(500).json({
            error: 'Erro ao confirmar preço do voo'
        });
    }
});

// 4. Criar Reserva
app.post('/api/flights/book', async (req, res) => {
    try {
        const { flightOffer, travelers, contacts } = req.body;

        // Validações
        if (!flightOffer || !travelers || !contacts) {
            return res.status(400).json({
                error: 'Dados incompletos para reserva'
            });
        }

        const bookingData = {
            data: {
                type: 'flight-order',
                flightOffers: [flightOffer],
                travelers: travelers,
                remarks: {
                    general: [{
                        subType: 'GENERAL_MISCELLANEOUS',
                        text: 'Reserva criada via FlightsMND'
                    }]
                },
                ticketingAgreement: {
                    option: 'DELAY_TO_CANCEL',
                    delay: '6D'
                },
                contacts: contacts
            }
        };

        const response = await amadeus.booking.flightOrders.post(bookingData);

        // Salvar reserva no banco de dados aqui
        // await saveBookingToDatabase(response.data);

        res.json({
            success: true,
            data: response.data,
            bookingReference: response.data.associatedRecords[0].reference
        });

    } catch (error) {
        console.error('Erro na criação de reserva:', error);
        res.status(500).json({
            error: 'Erro ao criar reserva'
        });
    }
});

// 5. Obter Status do Voo
app.get('/api/flights/status/:flightNumber/:date', async (req, res) => {
    try {
        const { flightNumber, date } = req.params;

        const response = await amadeus.schedule.flights.get({
            carrierCode: flightNumber.substring(0, 2),
            flightNumber: flightNumber.substring(2),
            scheduledDepartureDate: date
        });

        res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('Erro ao obter status do voo:', error);
        res.status(500).json({
            error: 'Erro ao obter status do voo'
        });
    }
});

// ====================================
// FUNÇÕES AUXILIARES
// ====================================

function formatFlightOffers(flightOffers) {
    return flightOffers.map(offer => {
        const outbound = offer.itineraries[0];
        const inbound = offer.itineraries[1] || null;

        return {
            id: offer.id,
            price: {
                total: parseFloat(offer.price.total),
                currency: offer.price.currency,
                base: parseFloat(offer.price.base),
                taxes: offer.price.taxes?.map(tax => ({
                    amount: parseFloat(tax.amount),
                    code: tax.code
                })) || []
            },
            validatingAirlines: offer.validatingAirlineCodes,
            travelerPricings: offer.travelerPricings,
            outbound: formatItinerary(outbound),
            inbound: inbound ? formatItinerary(inbound) : null,
            numberOfBookableSeats: offer.numberOfBookableSeats,
            oneWay: offer.oneWay,
            lastTicketingDate: offer.lastTicketingDate,
            rawOffer: offer // Para uso posterior no booking
        };
    });
}

function formatItinerary(itinerary) {
    const firstSegment = itinerary.segments[0];
    const lastSegment = itinerary.segments[itinerary.segments.length - 1];

    return {
        duration: itinerary.duration,
        segments: itinerary.segments.map(segment => ({
            departure: {
                iataCode: segment.departure.iataCode,
                terminal: segment.departure.terminal,
                at: segment.departure.at
            },
            arrival: {
                iataCode: segment.arrival.iataCode,
                terminal: segment.arrival.terminal,
                at: segment.arrival.at
            },
            carrierCode: segment.carrierCode,
            number: segment.number,
            aircraft: segment.aircraft,
            operating: segment.operating,
            duration: segment.duration,
            id: segment.id,
            numberOfStops: segment.numberOfStops,
            blacklistedInEU: segment.blacklistedInEU
        })),
        departure: {
            iataCode: firstSegment.departure.iataCode,
            terminal: firstSegment.departure.terminal,
            at: firstSegment.departure.at
        },
        arrival: {
            iataCode: lastSegment.arrival.iataCode,
            terminal: lastSegment.arrival.terminal,
            at: lastSegment.arrival.at
        },
        carrierCode: firstSegment.carrierCode,
        flightNumber: firstSegment.number,
        stops: itinerary.segments.length - 1
    };
}

// ====================================
// INICIALIZAÇÃO DO SERVIDOR
// ====================================

app.listen(port, () => {
    console.log(`🚀 Servidor FlightsMND rodando na porta ${port}`);
    console.log(`📡 Ambiente Amadeus: ${process.env.NODE_ENV === 'production' ? 'PRODUÇÃO' : 'TESTE'}`);
    
});