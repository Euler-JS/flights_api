const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('rate-limiter-flexible');
const Amadeus = require('amadeus');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use('/admin', express.static(path.join(__dirname, 'public/admin')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));


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
// app.use(cors({
//      origin: [
//         'https://flights-mnd.vercel.app',
//         // process.env.FRONTEND_URL,
//         // Para desenvolvimento local (se necessário)
//         'http://localhost:3000',
//         'http://localhost:3001',
//         'http://localhost:5500',
//         'http://127.0.0.1:5500'
//     ],
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
// }));
app.use(cors({
    origin: '*', // Permite QUALQUER origem
    credentials: false, // Desabilitar credentials com origem *
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
     "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "font-src 'self' https:; " +
    "img-src 'self' data: https:;"
  );
  next();
});

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://flights-mnd.vercel.app');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Rate limiting
const rateLimiter = new rateLimit.RateLimiterMemory({
    keyPrefix: 'flight_search',
    points: 100, // 50 requests
    duration: 3600, // per hour
});

app.get('/api/health', async (req, res) => {
    try {
        // Teste básico da API Amadeus
        const testResponse = await amadeus.referenceData.locations.get({
            keyword: 'LIS',
            subType: Amadeus.location.airport
        });

        res.json({
            success: true,
            message: 'Backend online e conectado à Amadeus',
            amadeus: {
                connected: true,
                environment: process.env.NODE_ENV === 'production' ? 'production' : 'test',
                testResults: testResponse.data.length + ' aeroportos encontrados'
            },
            frontend: process.env.FRONTEND_URL,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Erro no health check:', error.code || error.message);
        
        res.status(500).json({
            success: false,
            message: 'Erro na conexão com Amadeus',
            error: {
                code: error.code,
                message: error.message,
                description: error.code === 'AuthenticationError' 
                    ? 'Verifique as credenciais Amadeus no Vercel'
                    : 'Erro de conexão'
            },

            amadeus: {
                connected: false,
                environment: process.env.NODE_ENV === 'production' ? 'production' : 'test',
                clientId: process.env.AMADEUS_CLIENT_ID?.substring(0, 8) + '...'
            },
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

app.get('/admin/users', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/users.html'));
});

app.get('/admin/reservations', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/reservations.html'));
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

app.get('/api/admin/dashboard-metrics', async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        
        // Por enquanto, retornar dados fictícios
        // Em produção, buscar dados reais do banco de dados
        const metrics = await getDashboardMetrics(period);
        
        res.json({
            success: true,
            data: metrics,
            period: period,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Erro ao buscar métricas do dashboard:', error);
        res.status(500).json({
            error: 'Erro ao buscar métricas do dashboard'
        });
    }
});

// API: Dados de receita para gráficos
app.get('/api/admin/revenue-data', async (req, res) => {
    try {
        const { period = '14d' } = req.query;
        
        const revenueData = await getRevenueData(period);
        
        res.json({
            success: true,
            data: revenueData
        });

    } catch (error) {
        console.error('Erro ao buscar dados de receita:', error);
        res.status(500).json({
            error: 'Erro ao buscar dados de receita'
        });
    }
});

// API: Comissões por companhia aérea
app.get('/api/admin/airlines-commissions', async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        
        const commissionsData = await getAirlinesCommissions(period);
        
        res.json({
            success: true,
            data: commissionsData
        });

    } catch (error) {
        console.error('Erro ao buscar comissões:', error);
        res.status(500).json({
            error: 'Erro ao buscar dados de comissões'
        });
    }
});


// ====================================
// FUNÇÕES AUXILIARES PARA DASHBOARD
// ====================================

async function getDashboardMetrics(period) {
    // DADOS FICTÍCIOS - Substituir por consultas reais ao banco
    
    // Simular busca no banco de dados
    const now = new Date();
    const startDate = getStartDate(period);
    
    return {
        // Receitas
        dailyRevenue: 112000,
        dailyGrowth: 8.5,
        monthlyRevenue: 1850000,
        monthlyGrowth: 12.3,
        annualRevenue: 18500000,
        annualGrowth: 24.7,
        
        // Reservas
        todayBookings: 59,
        weekBookings: 312,
        monthBookings: 1247,
        bookingsGrowth: 8.2,
        
        // Métricas de negócio
        avgTicket: 1896,
        ticketGrowth: 5.2,
        conversionRate: 3.8,
        conversionGrowth: 2.1,
        
        // Comissões
        totalCommissions: 89000,
        commissionsGrowth: 15.8,
        
        // Período dos dados
        period: period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString()
    };
}

async function getRevenueData(period) {
    // DADOS FICTÍCIOS - Substituir por consultas reais ao banco
    
    const days = parseInt(period.replace('d', ''));
    const data = [];
    
    for (let i = days; i >= 1; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        data.push({
            date: date.toISOString().split('T')[0],
            day: date.getDate().toString().padStart(2, '0'),
            revenue: Math.floor(Math.random() * 80000) + 30000,
            bookings: Math.floor(Math.random() * 40) + 15
        });
    }
    
    return data;
}

async function getAirlinesCommissions(period) {
    // DADOS FICTÍCIOS - Substituir por consultas reais ao banco
    
    return [
        { name: 'TAP Air Portugal', commission: 25000, percentage: 28, bookings: 145 },
        { name: 'Lufthansa', commission: 18000, percentage: 20, bookings: 98 },
        { name: 'Air France', commission: 15000, percentage: 17, bookings: 87 },
        { name: 'Emirates', commission: 12000, percentage: 14, bookings: 65 },
        { name: 'British Airways', commission: 10000, percentage: 11, bookings: 54 },
        { name: 'Outros', commission: 9000, percentage: 10, bookings: 42 }
    ];
}

function getStartDate(period) {
    const now = new Date();
    const days = parseInt(period.replace('d', ''));
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    return startDate;
}

// ====================================
// MIDDLEWARE DE AUTENTICAÇÃO PARA ADMIN (OPCIONAL)
// ====================================

function requireAdminAuth(req, res, next) {
    // Implementar autenticação para rotas de admin
    // Por enquanto, comentado para facilitar teste
    
    /*
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Token de acesso necessário'
        });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        // Verificar JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (decoded.role !== 'admin') {
            return res.status(403).json({
                error: 'Acesso negado. Permissões de admin necessárias.'
            });
        }
        
        req.user = decoded;
        next();
        
    } catch (error) {
        return res.status(401).json({
            error: 'Token inválido'
        });
    }
    */
    
    // Por enquanto, apenas continuar
    next();
}

// Para usar autenticação, adicionar middleware nas rotas:
// app.get('/api/admin/dashboard-metrics', requireAdminAuth, async (req, res) => {

// ====================================
// EXEMPLO DE QUERY SQL REAL (COMENTADO)
// ====================================

/*
// Exemplo de como buscar métricas reais do banco de dados
async function getDashboardMetricsFromDB(period) {
    const db = getDatabase(); // Sua conexão com banco
    
    try {
        // Receita diária
        const dailyRevenue = await db.query(`
            SELECT SUM(total_amount) as revenue, COUNT(*) as bookings
            FROM bookings 
            WHERE DATE(created_at) = CURDATE() 
            AND status = 'confirmed'
        `);
        
        // Receita mensal
        const monthlyRevenue = await db.query(`
            SELECT SUM(total_amount) as revenue, COUNT(*) as bookings
            FROM bookings 
            WHERE MONTH(created_at) = MONTH(CURDATE()) 
            AND YEAR(created_at) = YEAR(CURDATE())
            AND status = 'confirmed'
        `);
        
        // Taxa de conversão
        const conversionRate = await db.query(`
            SELECT 
                (COUNT(CASE WHEN status = 'confirmed' THEN 1 END) * 100.0 / COUNT(*)) as conversion_rate
            FROM flight_searches fs
            LEFT JOIN bookings b ON fs.session_id = b.search_session_id
            WHERE fs.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);
        
        return {
            dailyRevenue: dailyRevenue[0].revenue || 0,
            dailyBookings: dailyRevenue[0].bookings || 0,
            monthlyRevenue: monthlyRevenue[0].revenue || 0,
            monthlyBookings: monthlyRevenue[0].bookings || 0,
            conversionRate: parseFloat(conversionRate[0].conversion_rate) || 0,
            // ... outros dados
        };
        
    } catch (error) {
        console.error('Erro ao buscar métricas do banco:', error);
        throw error;
    }
}
*/



// ====================================
// APIS PARA GESTÃO DE USUÁRIOS
// ====================================

// API: Métricas de usuários
app.get('/api/admin/users-metrics', async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        
        const metrics = await getUsersMetrics(period);
        
        res.json({
            success: true,
            data: metrics,
            period: period,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Erro ao buscar métricas de usuários:', error);
        res.status(500).json({
            error: 'Erro ao buscar métricas de usuários'
        });
    }
});

// API: Lista de usuários com filtros e paginação
app.get('/api/admin/users', async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            search = '', 
            status = 'all',
            sortBy = 'name',
            sortOrder = 'asc' 
        } = req.query;
        
        const result = await getUsers({
            page: parseInt(page),
            limit: parseInt(limit),
            search,
            status,
            sortBy,
            sortOrder
        });
        
        res.json({
            success: true,
            data: result.users,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(result.total / limit),
                totalUsers: result.total,
                usersPerPage: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        res.status(500).json({
            error: 'Erro ao buscar usuários'
        });
    }
});

// API: Detalhes de um usuário específico
app.get('/api/admin/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const user = await getUserById(id);
        
        if (!user) {
            return res.status(404).json({
                error: 'Usuário não encontrado'
            });
        }
        
        res.json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({
            error: 'Erro ao buscar usuário'
        });
    }
});

// API: Atualizar usuário
app.put('/api/admin/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const updatedUser = await updateUser(id, updateData);
        
        res.json({
            success: true,
            data: updatedUser,
            message: 'Usuário atualizado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({
            error: 'Erro ao atualizar usuário'
        });
    }
});

// API: Criar novo usuário
app.post('/api/admin/users', async (req, res) => {
    try {
        const userData = req.body;
        
        // Validações básicas
        if (!userData.name || !userData.email) {
            return res.status(400).json({
                error: 'Nome e email são obrigatórios'
            });
        }
        
        const newUser = await createUser(userData);
        
        res.status(201).json({
            success: true,
            data: newUser,
            message: 'Usuário criado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({
            error: 'Erro ao criar usuário'
        });
    }
});

// API: Deletar usuário
app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        await deleteUser(id);
        
        res.json({
            success: true,
            message: 'Usuário deletado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao deletar usuário:', error);
        res.status(500).json({
            error: 'Erro ao deletar usuário'
        });
    }
});

// API: Top clientes
app.get('/api/admin/top-customers', async (req, res) => {
    try {
        const { limit = 5 } = req.query;
        
        const topCustomers = await getTopCustomers(parseInt(limit));
        
        res.json({
            success: true,
            data: topCustomers
        });

    } catch (error) {
        console.error('Erro ao buscar top clientes:', error);
        res.status(500).json({
            error: 'Erro ao buscar top clientes'
        });
    }
});

// API: Dados de crescimento de usuários
app.get('/api/admin/users-growth', async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        
        const growthData = await getUsersGrowthData(period);
        
        res.json({
            success: true,
            data: growthData
        });

    } catch (error) {
        console.error('Erro ao buscar dados de crescimento:', error);
        res.status(500).json({
            error: 'Erro ao buscar dados de crescimento'
        });
    }
});

// API: Tickets de suporte
app.get('/api/admin/support-tickets', async (req, res) => {
    try {
        const { status = 'open', page = 1, limit = 10 } = req.query;
        
        const tickets = await getSupportTickets({
            status,
            page: parseInt(page),
            limit: parseInt(limit)
        });
        
        res.json({
            success: true,
            data: tickets
        });

    } catch (error) {
        console.error('Erro ao buscar tickets:', error);
        res.status(500).json({
            error: 'Erro ao buscar tickets de suporte'
        });
    }
});

// API: Ticket específico de um usuário
app.get('/api/admin/users/:id/support-ticket', async (req, res) => {
    try {
        const { id } = req.params;
        
        const ticket = await getUserSupportTicket(id);
        
        res.json({
            success: true,
            data: ticket
        });

    } catch (error) {
        console.error('Erro ao buscar ticket do usuário:', error);
        res.status(500).json({
            error: 'Erro ao buscar ticket'
        });
    }
});

// API: Responder ticket de suporte
app.post('/api/admin/support-tickets/:ticketId/reply', async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { message, adminId = 'admin' } = req.body;
        
        if (!message) {
            return res.status(400).json({
                error: 'Mensagem é obrigatória'
            });
        }
        
        const reply = await addTicketReply(ticketId, message, adminId);
        
        res.json({
            success: true,
            data: reply,
            message: 'Resposta enviada com sucesso'
        });

    } catch (error) {
        console.error('Erro ao responder ticket:', error);
        res.status(500).json({
            error: 'Erro ao responder ticket'
        });
    }
});

// API: Resolver ticket
app.patch('/api/admin/support-tickets/:ticketId/resolve', async (req, res) => {
    try {
        const { ticketId } = req.params;
        
        await resolveTicket(ticketId);
        
        res.json({
            success: true,
            message: 'Ticket resolvido com sucesso'
        });

    } catch (error) {
        console.error('Erro ao resolver ticket:', error);
        res.status(500).json({
            error: 'Erro ao resolver ticket'
        });
    }
});

// API: Exportar usuários
app.get('/api/admin/users/export', async (req, res) => {
    try {
        const { format = 'csv', status = 'all' } = req.query;
        
        const usersData = await getAllUsersForExport(status);
        
        if (format === 'csv') {
            const csv = convertToCSV(usersData);
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=usuarios.csv');
            res.send(csv);
        } else {
            res.json({
                success: true,
                data: usersData
            });
        }

    } catch (error) {
        console.error('Erro ao exportar usuários:', error);
        res.status(500).json({
            error: 'Erro ao exportar usuários'
        });
    }
});

// ====================================
// FUNÇÕES AUXILIARES PARA USUÁRIOS
// ====================================

async function getUsersMetrics(period) {
    // DADOS FICTÍCIOS - Substituir por consultas reais ao banco
    
    return {
        activeUsers: 2847,
        activeUsersGrowth: 12.5,
        newUsers: 156,
        newUsersGrowth: 8.3,
        openTickets: 23,
        ticketsGrowth: 2.1,
        paymentIssues: 7,
        paymentIssuesGrowth: -3.2
    };
}

async function getUsers(filters) {
    // DADOS FICTÍCIOS - Substituir por consultas reais ao banco
    
    // Simular busca com filtros
    const mockUsers = generateMockUsersData();
    
    let filteredUsers = mockUsers;
    
    // Aplicar filtros
    if (filters.search) {
        filteredUsers = filteredUsers.filter(user => 
            user.name.toLowerCase().includes(filters.search.toLowerCase()) ||
            user.email.toLowerCase().includes(filters.search.toLowerCase())
        );
    }
    
    if (filters.status !== 'all') {
        filteredUsers = filteredUsers.filter(user => user.status === filters.status);
    }
    
    // Aplicar ordenação
    filteredUsers.sort((a, b) => {
        let aValue = a[filters.sortBy];
        let bValue = b[filters.sortBy];
        
        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }
        
        if (filters.sortOrder === 'desc') {
            return bValue > aValue ? 1 : -1;
        }
        return aValue > bValue ? 1 : -1;
    });
    
    // Aplicar paginação
    const startIndex = (filters.page - 1) * filters.limit;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + filters.limit);
    
    return {
        users: paginatedUsers,
        total: filteredUsers.length
    };
}

async function getUserById(id) {
    // DADOS FICTÍCIOS - Substituir por consulta real ao banco
    
    const mockUsers = generateMockUsersData();
    return mockUsers.find(user => user.id === parseInt(id));
}

async function updateUser(id, updateData) {
    // IMPLEMENTAR: Atualizar usuário no banco de dados
    
    console.log(`Atualizando usuário ${id}:`, updateData);
    
    // Simular resposta
    return {
        id: parseInt(id),
        ...updateData,
        updatedAt: new Date().toISOString()
    };
}

async function createUser(userData) {
    // IMPLEMENTAR: Criar usuário no banco de dados
    
    console.log('Criando novo usuário:', userData);
    
    // Simular resposta
    return {
        id: Math.floor(Math.random() * 10000),
        ...userData,
        status: 'active',
        createdAt: new Date().toISOString()
    };
}

async function deleteUser(id) {
    // IMPLEMENTAR: Deletar usuário do banco de dados
    
    console.log(`Deletando usuário ${id}`);
    
    // Simular operação
    return true;
}

async function getTopCustomers(limit) {
    // DADOS FICTÍCIOS - Substituir por consulta real ao banco
    
    return [
        { id: 1, name: 'Maria Silva', email: 'maria.silva@email.com', bookings: 24, totalSpent: 28500, avatar: 'MS' },
        { id: 2, name: 'João Santos', email: 'joao.santos@email.com', bookings: 19, totalSpent: 22300, avatar: 'JS' },
        { id: 3, name: 'Ana Costa', email: 'ana.costa@email.com', bookings: 17, totalSpent: 19800, avatar: 'AC' },
        { id: 4, name: 'Pedro Lima', email: 'pedro.lima@email.com', bookings: 15, totalSpent: 18400, avatar: 'PL' },
        { id: 5, name: 'Sofia Mendes', email: 'sofia.mendes@email.com', bookings: 14, totalSpent: 16900, avatar: 'SM' }
    ].slice(0, limit);
}

async function getUsersGrowthData(period) {
    // DADOS FICTÍCIOS - Substituir por consulta real ao banco
    
    const days = parseInt(period.replace('d', ''));
    const data = [];
    
    for (let i = days; i >= 1; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        data.push({
            date: date.toISOString().split('T')[0],
            day: date.getDate().toString().padStart(2, '0'),
            users: 26 + (days - i) * 7 + Math.floor(Math.random() * 1),
            newUsers: Math.floor(Math.random() * 2) + 5
        });
    }
    
    return data;
}

async function getSupportTickets(filters) {
    // DADOS FICTÍCIOS - Substituir por consulta real ao banco
    
    return [
        {
            id: 1,
            userId: 123,
            userName: 'Maria Silva',
            subject: 'Problema com check-in',
            status: 'open',
            priority: 'high',
            createdAt: new Date().toISOString(),
            lastReply: new Date().toISOString()
        },
        {
            id: 2,
            userId: 456,
            userName: 'João Santos',
            subject: 'Reembolso de voo cancelado',
            status: 'pending',
            priority: 'medium',
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            lastReply: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
        }
    ];
}

async function getUserSupportTicket(userId) {
    // DADOS FICTÍCIOS - Substituir por consulta real ao banco
    
    return {
        id: 1,
        userId: parseInt(userId),
        subject: 'Problema com check-in online',
        status: 'open',
        messages: [
            {
                id: 1,
                sender: 'user',
                message: 'Olá, estou com problemas para fazer o check-in online. O sistema diz que há um erro no meu cartão de embarque.',
                timestamp: new Date().toISOString()
            },
            {
                id: 2,
                sender: 'admin',
                message: 'Olá! Verificamos a sua reserva e encontramos o problema. O check-in está bloqueado devido a uma pendência no pagamento.',
                timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
            }
        ]
    };
}

async function addTicketReply(ticketId, message, adminId) {
    // IMPLEMENTAR: Adicionar resposta ao ticket no banco de dados
    
    console.log(`Adicionando resposta ao ticket ${ticketId}:`, message);
    
    return {
        id: Math.floor(Math.random() * 1000),
        ticketId: parseInt(ticketId),
        sender: 'admin',
        adminId: adminId,
        message: message,
        timestamp: new Date().toISOString()
    };
}

async function resolveTicket(ticketId) {
    // IMPLEMENTAR: Resolver ticket no banco de dados
    
    console.log(`Resolvendo ticket ${ticketId}`);
    return true;
}

async function getAllUsersForExport(status) {
    // IMPLEMENTAR: Buscar todos os usuários para exportação
    
    const mockUsers = generateMockUsersData();
    
    if (status !== 'all') {
        return mockUsers.filter(user => user.status === status);
    }
    
    return mockUsers;
}

function convertToCSV(users) {
    const headers = ['ID', 'Nome', 'Email', 'Status', 'Reservas', 'Total Gasto', 'Última Atividade'];
    const csvContent = [
        headers.join(','),
        ...users.map(user => [
            user.id,
            `"${user.name}"`,
            user.email,
            user.status,
            user.bookings,
            user.totalSpent,
            new Date(user.lastActivity).toLocaleDateString('pt-BR')
        ].join(','))
    ].join('\n');
    
    return csvContent;
}

function generateMockUsersData() {
    // Mesma função do frontend, mas simplificada para o backend
    const names = [
        'Maria Silva', 'João Santos', 'Ana Costa', 'Pedro Lima', 'Sofia Mendes',
        'Carlos Oliveira', 'Fernanda Rocha', 'Miguel Torres', 'Inês Ferreira', 'Rui Cardoso'
    ];
    
    const domains = ['gmail.com', 'outlook.com', 'yahoo.com'];
    const statuses = ['active', 'inactive', 'payment_issues', 'support_pending', 'vip'];
    
    const users = [];
    
    for (let i = 0; i < 50; i++) {
        const name = names[Math.floor(Math.random() * names.length)];
        const email = name.toLowerCase()
            .replace(/ /g, '.')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') + 
            Math.floor(Math.random() * 100) + 
            '@' + domains[Math.floor(Math.random() * domains.length)];
        
        const bookings = Math.floor(Math.random() * 25);
        const totalSpent = bookings * (Math.floor(Math.random() * 2000) + 500);
        
        users.push({
            id: i + 1,
            name: name,
            email: email,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            bookings: bookings,
            totalSpent: totalSpent,
            lastActivity: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
            registrationDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
            phone: '+351 9' + Math.floor(Math.random() * 90000000 + 10000000),
            country: Math.random() > 0.7 ? 'Brasil' : 'Portugal',
            avatar: name.split(' ').map(n => n[0]).join('').toUpperCase()
        });
    }
    
    return users;
}

// ====================================
// EXEMPLOS DE QUERIES SQL REAIS (COMENTADAS)
// ====================================

/*
// Exemplo de como buscar métricas reais do banco de dados
async function getUsersMetricsFromDB(period) {
    const db = getDatabase();
    
    try {
        // Usuários ativos nos últimos 30 dias
        const activeUsers = await db.query(`
            SELECT COUNT(DISTINCT id) as count
            FROM users 
            WHERE last_activity >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND status = 'active'
        `);
        
        // Novos registros na última semana
        const newUsers = await db.query(`
            SELECT COUNT(*) as count
            FROM users 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);
        
        // Tickets de suporte abertos
        const openTickets = await db.query(`
            SELECT COUNT(*) as count
            FROM support_tickets 
            WHERE status IN ('open', 'pending')
        `);
        
        // Usuários com problemas de pagamento
        const paymentIssues = await db.query(`
            SELECT COUNT(DISTINCT user_id) as count
            FROM bookings 
            WHERE payment_status = 'failed' 
            AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);
        
        return {
            activeUsers: activeUsers[0].count,
            newUsers: newUsers[0].count,
            openTickets: openTickets[0].count,
            paymentIssues: paymentIssues[0].count
        };
        
    } catch (error) {
        console.error('Erro ao buscar métricas de usuários:', error);
        throw error;
    }
}

// Exemplo de busca de usuários com filtros
async function getUsersFromDB(filters) {
    const db = getDatabase();
    
    try {
        let whereClause = 'WHERE 1=1';
        let params = [];
        
        if (filters.search) {
            whereClause += ' AND (name LIKE ? OR email LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }
        
        if (filters.status !== 'all') {
            whereClause += ' AND status = ?';
            params.push(filters.status);
        }
        
        const orderClause = `ORDER BY ${filters.sortBy} ${filters.sortOrder}`;
        const limitClause = `LIMIT ? OFFSET ?`;
        
        const offset = (filters.page - 1) * filters.limit;
        params.push(filters.limit, offset);
        
        const users = await db.query(`
            SELECT 
                id, name, email, status, phone, country,
                created_at as registrationDate,
                last_activity as lastActivity,
                (SELECT COUNT(*) FROM bookings WHERE user_id = users.id) as bookings,
                (SELECT COALESCE(SUM(total_amount), 0) FROM bookings WHERE user_id = users.id AND status = 'confirmed') as totalSpent
            FROM users 
            ${whereClause} 
            ${orderClause} 
            ${limitClause}
        `, params);
        
        // Contar total para paginação
        const countParams = params.slice(0, -2); // Remove limit e offset
        const total = await db.query(`
            SELECT COUNT(*) as total
            FROM users 
            ${whereClause}
        `, countParams);
        
        return {
            users: users,
            total: total[0].total
        };
        
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        throw error;
    }
}
*/


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
// APIS PARA GESTÃO DE RESERVAS
// ====================================

// API: Métricas de reservas
app.get('/api/admin/reservations-metrics', async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        
        const metrics = await getReservationsMetrics(period);
        
        res.json({
            success: true,
            data: metrics,
            period: period,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Erro ao buscar métricas de reservas:', error);
        res.status(500).json({
            error: 'Erro ao buscar métricas de reservas'
        });
    }
});

// API: Lista de reservas com filtros e paginação
app.get('/api/admin/reservations', async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            search = '', 
            status = 'all',
            period = 'all',
            sortBy = 'bookingDate',
            sortOrder = 'desc' 
        } = req.query;
        
        const result = await getReservations({
            page: parseInt(page),
            limit: parseInt(limit),
            search,
            status,
            period,
            sortBy,
            sortOrder
        });
        
        res.json({
            success: true,
            data: result.reservations,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(result.total / limit),
                totalReservations: result.total,
                reservationsPerPage: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Erro ao buscar reservas:', error);
        res.status(500).json({
            error: 'Erro ao buscar reservas'
        });
    }
});

// API: Detalhes de uma reserva específica
app.get('/api/admin/reservations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const reservation = await getReservationById(id);
        
        if (!reservation) {
            return res.status(404).json({
                error: 'Reserva não encontrada'
            });
        }
        
        res.json({
            success: true,
            data: reservation
        });

    } catch (error) {
        console.error('Erro ao buscar reserva:', error);
        res.status(500).json({
            error: 'Erro ao buscar reserva'
        });
    }
});

// API: Atualizar reserva
app.put('/api/admin/reservations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const updatedReservation = await updateReservation(id, updateData);
        
        res.json({
            success: true,
            data: updatedReservation,
            message: 'Reserva atualizada com sucesso'
        });

    } catch (error) {
        console.error('Erro ao atualizar reserva:', error);
        res.status(500).json({
            error: 'Erro ao atualizar reserva'
        });
    }
});

// API: Criar nova reserva
app.post('/api/admin/reservations', async (req, res) => {
    try {
        const reservationData = req.body;
        
        // Validações básicas
        if (!reservationData.passenger || !reservationData.flightNumber) {
            return res.status(400).json({
                error: 'Dados do passageiro e voo são obrigatórios'
            });
        }
        
        const newReservation = await createReservation(reservationData);
        
        res.status(201).json({
            success: true,
            data: newReservation,
            message: 'Reserva criada com sucesso'
        });

    } catch (error) {
        console.error('Erro ao criar reserva:', error);
        res.status(500).json({
            error: 'Erro ao criar reserva'
        });
    }
});

// API: Cancelar reserva
app.patch('/api/admin/reservations/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, refundAmount } = req.body;
        
        const cancelledReservation = await cancelReservation(id, reason, refundAmount);
        
        res.json({
            success: true,
            data: cancelledReservation,
            message: 'Reserva cancelada com sucesso'
        });

    } catch (error) {
        console.error('Erro ao cancelar reserva:', error);
        res.status(500).json({
            error: 'Erro ao cancelar reserva'
        });
    }
});

// API: Processar pagamento
app.post('/api/admin/reservations/:id/payment', async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentMethod, amount, notes } = req.body;
        
        if (!paymentMethod || !amount) {
            return res.status(400).json({
                error: 'Método de pagamento e valor são obrigatórios'
            });
        }
        
        const paymentResult = await processReservationPayment(id, {
            paymentMethod,
            amount: parseFloat(amount),
            notes,
            processedBy: 'admin', // Em produção, usar ID do admin logado
            processedAt: new Date()
        });
        
        res.json({
            success: true,
            data: paymentResult,
            message: 'Pagamento processado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao processar pagamento:', error);
        res.status(500).json({
            error: 'Erro ao processar pagamento'
        });
    }
});

// API: Status do voo para uma reserva
app.get('/api/admin/reservations/:id/flight-status', async (req, res) => {
    try {
        const { id } = req.params;
        
        const reservation = await getReservationById(id);
        
        if (!reservation) {
            return res.status(404).json({
                error: 'Reserva não encontrada'
            });
        }
        
        // Usar API Amadeus para buscar status do voo
        const flightStatus = await getFlightStatus(
            reservation.flightNumber, 
            reservation.departureDate
        );
        
        res.json({
            success: true,
            data: flightStatus
        });

    } catch (error) {
        console.error('Erro ao buscar status do voo:', error);
        res.status(500).json({
            error: 'Erro ao buscar status do voo'
        });
    }
});

// API: Enviar email de confirmação
app.post('/api/admin/reservations/:id/send-confirmation', async (req, res) => {
    try {
        const { id } = req.params;
        
        const emailResult = await sendConfirmationEmail(id);
        
        res.json({
            success: true,
            data: emailResult,
            message: 'Email de confirmação enviado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao enviar email:', error);
        res.status(500).json({
            error: 'Erro ao enviar email de confirmação'
        });
    }
});

// API: Rotas mais populares
app.get('/api/admin/popular-routes', async (req, res) => {
    try {
        const { period = '30d', limit = 10 } = req.query;
        
        const popularRoutes = await getPopularRoutes(period, parseInt(limit));
        
        res.json({
            success: true,
            data: popularRoutes
        });

    } catch (error) {
        console.error('Erro ao buscar rotas populares:', error);
        res.status(500).json({
            error: 'Erro ao buscar rotas populares'
        });
    }
});

// API: Estatísticas por companhia aérea
app.get('/api/admin/airlines-stats', async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        
        const airlinesStats = await getAirlinesStats(period);
        
        res.json({
            success: true,
            data: airlinesStats
        });

    } catch (error) {
        console.error('Erro ao buscar estatísticas de companhias:', error);
        res.status(500).json({
            error: 'Erro ao buscar estatísticas de companhias'
        });
    }
});

// API: Alertas de voos
app.get('/api/admin/flight-alerts', async (req, res) => {
    try {
        const alerts = await getFlightAlerts();
        
        res.json({
            success: true,
            data: alerts
        });

    } catch (error) {
        console.error('Erro ao buscar alertas de voos:', error);
        res.status(500).json({
            error: 'Erro ao buscar alertas de voos'
        });
    }
});

// API: Reembolsos pendentes
app.get('/api/admin/pending-refunds', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        const pendingRefunds = await getPendingRefunds(parseInt(limit));
        
        res.json({
            success: true,
            data: pendingRefunds
        });

    } catch (error) {
        console.error('Erro ao buscar reembolsos pendentes:', error);
        res.status(500).json({
            error: 'Erro ao buscar reembolsos pendentes'
        });
    }
});

// API: Processar reembolso
app.post('/api/admin/reservations/:id/refund', async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, reason, method } = req.body;
        
        if (!amount || !reason) {
            return res.status(400).json({
                error: 'Valor e motivo do reembolso são obrigatórios'
            });
        }
        
        const refundResult = await processRefund(id, {
            amount: parseFloat(amount),
            reason,
            method: method || 'original_payment',
            processedBy: 'admin', // Em produção, usar ID do admin logado
            processedAt: new Date()
        });
        
        res.json({
            success: true,
            data: refundResult,
            message: 'Reembolso processado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao processar reembolso:', error);
        res.status(500).json({
            error: 'Erro ao processar reembolso'
        });
    }
});

// API: Exportar reservas
app.get('/api/admin/reservations/export', async (req, res) => {
    try {
        const { format = 'csv', status = 'all', period = 'all' } = req.query;
        
        const reservationsData = await getAllReservationsForExport({ status, period });
        
        if (format === 'csv') {
            const csv = convertReservationsToCSV(reservationsData);
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=reservas.csv');
            res.send(csv);
        } else {
            res.json({
                success: true,
                data: reservationsData
            });
        }

    } catch (error) {
        console.error('Erro ao exportar reservas:', error);
        res.status(500).json({
            error: 'Erro ao exportar reservas'
        });
    }
});

// API: Atualizar status de múltiplos voos
app.post('/api/admin/refresh-flight-status', async (req, res) => {
    try {
        const { flightNumbers } = req.body;
        
        const results = await refreshMultipleFlightStatus(flightNumbers);
        
        res.json({
            success: true,
            data: results,
            message: 'Status dos voos atualizados'
        });

    } catch (error) {
        console.error('Erro ao atualizar status dos voos:', error);
        res.status(500).json({
            error: 'Erro ao atualizar status dos voos'
        });
    }
});

// ====================================
// FUNÇÕES AUXILIARES PARA RESERVAS
// ====================================

async function getReservationsMetrics(period) {
    // DADOS FICTÍCIOS - Substituir por consultas reais ao banco
    
    return {
        todayReservations: 59,
        todayGrowth: 15.2,
        pendingPayments: 12,
        pendingGrowth: 8.7,
        cancellations: 8,
        cancellationsGrowth: -2.1,
        reservationsRevenue: 1250000,
        revenueGrowth: 12.5
    };
}

async function getReservations(filters) {
    // DADOS FICTÍCIOS - Substituir por consultas reais ao banco
    
    // Simular busca com filtros
    const mockReservations = generateMockReservationsData();
    
    let filteredReservations = mockReservations;
    
    // Aplicar filtros
    if (filters.search) {
        filteredReservations = filteredReservations.filter(reservation => 
            reservation.bookingCode.toLowerCase().includes(filters.search.toLowerCase()) ||
            reservation.passenger.toLowerCase().includes(filters.search.toLowerCase()) ||
            reservation.flightNumber.toLowerCase().includes(filters.search.toLowerCase())
        );
    }
    
    if (filters.status !== 'all') {
        filteredReservations = filteredReservations.filter(reservation => 
            reservation.status === filters.status
        );
    }
    
    if (filters.period !== 'all') {
        const now = new Date();
        let startDate;
        
        switch (filters.period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
        }
        
        if (startDate) {
            filteredReservations = filteredReservations.filter(reservation => 
                new Date(reservation.bookingDate) >= startDate
            );
        }
    }
    
    // Aplicar ordenação
    filteredReservations.sort((a, b) => {
        let aValue = a[filters.sortBy];
        let bValue = b[filters.sortBy];
        
        if (filters.sortBy === 'departureDate' || filters.sortBy === 'bookingDate') {
            aValue = new Date(aValue);
            bValue = new Date(bValue);
        }
        
        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }
        
        if (filters.sortOrder === 'desc') {
            return bValue > aValue ? 1 : -1;
        }
        return aValue > bValue ? 1 : -1;
    });
    
    // Aplicar paginação
    const startIndex = (filters.page - 1) * filters.limit;
    const paginatedReservations = filteredReservations.slice(startIndex, startIndex + filters.limit);
    
    return {
        reservations: paginatedReservations,
        total: filteredReservations.length
    };
}

async function getReservationById(id) {
    // DADOS FICTÍCIOS - Substituir por consulta real ao banco
    
    const mockReservations = generateMockReservationsData();
    return mockReservations.find(reservation => reservation.id === parseInt(id));
}

async function updateReservation(id, updateData) {
    // IMPLEMENTAR: Atualizar reserva no banco de dados
    
    console.log(`Atualizando reserva ${id}:`, updateData);
    
    // Simular resposta
    return {
        id: parseInt(id),
        ...updateData,
        updatedAt: new Date().toISOString()
    };
}

async function createReservation(reservationData) {
    // IMPLEMENTAR: Criar reserva no banco de dados
    
    console.log('Criando nova reserva:', reservationData);
    
    // Simular resposta
    return {
        id: Math.floor(Math.random() * 10000),
        bookingCode: 'MND' + Math.floor(Math.random() * 9000 + 1000),
        ...reservationData,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
}

async function cancelReservation(id, reason, refundAmount) {
    // IMPLEMENTAR: Cancelar reserva no banco de dados
    
    console.log(`Cancelando reserva ${id}:`, { reason, refundAmount });
    
    // Simular resposta
    return {
        id: parseInt(id),
        status: 'cancelled',
        cancellationReason: reason,
        refundAmount: refundAmount,
        cancelledAt: new Date().toISOString()
    };
}

async function processReservationPayment(id, paymentData) {
    // IMPLEMENTAR: Processar pagamento no sistema de pagamento
    
    console.log(`Processando pagamento para reserva ${id}:`, paymentData);
    
    // Simular resposta
    return {
        reservationId: parseInt(id),
        paymentId: 'PAY' + Math.floor(Math.random() * 9000 + 1000),
        status: 'paid',
        ...paymentData
    };
}

async function getFlightStatus(flightNumber, departureDate) {
    // IMPLEMENTAR: Usar API Amadeus para status real do voo
    
    // Por enquanto, simular dados
    const statuses = ['on-time', 'delayed', 'cancelled', 'boarding', 'departed'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    return {
        flightNumber: flightNumber,
        date: departureDate,
        status: status,
        delay: status === 'delayed' ? Math.floor(Math.random() * 120) + 15 : null,
        gate: status !== 'cancelled' ? Math.floor(Math.random() * 50) + 1 : null,
        terminal: status !== 'cancelled' ? Math.floor(Math.random() * 3) + 1 : null,
        lastUpdated: new Date().toISOString()
    };
}

async function sendConfirmationEmail(reservationId) {
    // IMPLEMENTAR: Enviar email usando serviço de email
    
    console.log(`Enviando email de confirmação para reserva ${reservationId}`);
    
    // Simular resposta
    return {
        reservationId: parseInt(reservationId),
        emailSent: true,
        sentAt: new Date().toISOString()
    };
}

async function getPopularRoutes(period, limit) {
    // DADOS FICTÍCIOS - Substituir por consulta real ao banco
    
    return [
        { route: 'LIS-MAD', from: 'Lisboa', to: 'Madrid', bookings: 145, revenue: 89000 },
        { route: 'OPO-PAR', from: 'Porto', to: 'Paris', bookings: 98, revenue: 78000 },
        { route: 'LIS-LON', from: 'Lisboa', to: 'Londres', bookings: 87, revenue: 95000 },
        { route: 'FAO-BCN', from: 'Faro', to: 'Barcelona', bookings: 76, revenue: 45000 },
        { route: 'LIS-NYC', from: 'Lisboa', to: 'Nova York', bookings: 65, revenue: 125000 }
    ].slice(0, limit);
}

async function getAirlinesStats(period) {
    // DADOS FICTÍCIOS - Substituir por consulta real ao banco
    
    return [
        { name: 'TAP', bookings: 234, revenue: 145000, percentage: 35 },
        { name: 'Ryanair', bookings: 189, revenue: 98000, percentage: 28 },
        { name: 'Lufthansa', bookings: 123, revenue: 156000, percentage: 18 },
        { name: 'Air France', bookings: 87, revenue: 123000, percentage: 13 },
        { name: 'Outros', bookings: 42, revenue: 56000, percentage: 6 }
    ];
}

async function getFlightAlerts() {
    // DADOS FICTÍCIOS - Substituir por integração real com APIs de voo
    
    return [
        { 
            flightNumber: 'TP1234', 
            status: 'delayed', 
            delay: 45, 
            route: 'LIS-MAD',
            affectedReservations: 12
        },
        { 
            flightNumber: 'FR7892', 
            status: 'cancelled', 
            delay: null, 
            route: 'OPO-PAR',
            affectedReservations: 8
        },
        { 
            flightNumber: 'LH4567', 
            status: 'delayed', 
            delay: 20, 
            route: 'LIS-FRA',
            affectedReservations: 5
        }
    ];
}

async function getPendingRefunds(limit) {
    // DADOS FICTÍCIOS - Substituir por consulta real ao banco
    
    return [
        { 
            reservationId: 123,
            bookingCode: 'MND789', 
            passenger: 'Ana Silva', 
            amount: 450, 
            requestedDays: 3,
            reason: 'Cancelamento de voo'
        },
        { 
            reservationId: 456,
            bookingCode: 'MND456', 
            passenger: 'Carlos Santos', 
            amount: 890, 
            requestedDays: 7,
            reason: 'Atraso superior a 3 horas'
        },
        { 
            reservationId: 789,
            bookingCode: 'MND123', 
            passenger: 'Maria Costa', 
            amount: 320, 
            requestedDays: 2,
            reason: 'Solicitação do cliente'
        }
    ].slice(0, limit);
}

async function processRefund(reservationId, refundData) {
    // IMPLEMENTAR: Processar reembolso no sistema de pagamento
    
    console.log(`Processando reembolso para reserva ${reservationId}:`, refundData);
    
    // Simular resposta
    return {
        reservationId: parseInt(reservationId),
        refundId: 'REF' + Math.floor(Math.random() * 9000 + 1000),
        status: 'processed',
        ...refundData
    };
}

async function getAllReservationsForExport(filters) {
    // IMPLEMENTAR: Buscar todas as reservas para exportação
    
    const mockReservations = generateMockReservationsData();
    
    // Aplicar filtros
    let filteredReservations = mockReservations;
    
    if (filters.status !== 'all') {
        filteredReservations = filteredReservations.filter(r => r.status === filters.status);
    }
    
    if (filters.period !== 'all') {
        // Implementar filtro por período
    }
    
    return filteredReservations;
}

function convertReservationsToCSV(reservations) {
    const headers = [
        'Código', 'Passageiro', 'Email', 'Telefone', 'Voo', 'Rota', 
        'Data Partida', 'Status', 'Pagamento', 'Valor Total', 'Data Reserva'
    ];
    
    const csvContent = [
        headers.join(','),
        ...reservations.map(r => [
            r.bookingCode,
            `"${r.passenger}"`,
            r.email,
            r.phone,
            r.flightNumber,
            `"${r.route.from} → ${r.route.to}"`,
            new Date(r.departureDate).toLocaleDateString('pt-BR'),
            r.status,
            r.paymentStatus,
            r.totalAmount,
            new Date(r.bookingDate).toLocaleDateString('pt-BR')
        ].join(','))
    ].join('\n');
    
    return csvContent;
}

async function refreshMultipleFlightStatus(flightNumbers) {
    // IMPLEMENTAR: Atualizar status de múltiplos voos
    
    console.log('Atualizando status dos voos:', flightNumbers);
    
    const results = [];
    
    if (flightNumbers && flightNumbers.length > 0) {
        for (const flightNumber of flightNumbers) {
            try {
                const status = await getFlightStatus(flightNumber, new Date());
                results.push({ flightNumber, status, updated: true });
            } catch (error) {
                results.push({ flightNumber, error: error.message, updated: false });
            }
        }
    } else {
        // Se não especificados, atualizar todos os voos ativos
        const activeFlights = ['TP1234', 'FR7892', 'LH4567', 'AF8901'];
        for (const flightNumber of activeFlights) {
            const status = await getFlightStatus(flightNumber, new Date());
            results.push({ flightNumber, status, updated: true });
        }
    }
    
    return results;
}

function generateMockReservationsData() {
    // Função para gerar dados fictícios - implementação similar à do frontend
    // mas com mais detalhes para o backend
    
    const passengers = [
        'Maria Silva', 'João Santos', 'Ana Costa', 'Pedro Lima', 'Sofia Mendes',
        'Carlos Oliveira', 'Fernanda Rocha', 'Miguel Torres', 'Inês Ferreira', 'Rui Cardoso'
    ];

    const routes = [
        { from: 'LIS', to: 'MAD', fromName: 'Lisboa', toName: 'Madrid' },
        { from: 'OPO', to: 'PAR', fromName: 'Porto', toName: 'Paris' },
        { from: 'LIS', to: 'LON', fromName: 'Lisboa', toName: 'Londres' },
        { from: 'FAO', to: 'BCN', fromName: 'Faro', toName: 'Barcelona' },
        { from: 'LIS', to: 'NYC', fromName: 'Lisboa', toName: 'Nova York' }
    ];

    const airlines = ['TP', 'FR', 'LH', 'AF', 'BA'];
    const statuses = ['confirmed', 'pending', 'cancelled', 'refunded'];
    const paymentStatuses = ['paid', 'pending', 'failed', 'refunded'];
    
    const reservations = [];
    
    for (let i = 0; i < 100; i++) {
        const passenger = passengers[Math.floor(Math.random() * passengers.length)];
        const route = routes[Math.floor(Math.random() * routes.length)];
        const airline = airlines[Math.floor(Math.random() * airlines.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const paymentStatus = paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)];
        
        const bookingDate = new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000);
        const departureDate = new Date(bookingDate.getTime() + Math.random() * 90 * 24 * 60 * 60 * 1000);
        
        const totalAmount = Math.floor(Math.random() * 1500) + 200;
        
        reservations.push({
            id: i + 1,
            bookingCode: 'MND' + (1000 + i).toString(),
            passenger: passenger,
            email: passenger.toLowerCase().replace(/ /g, '.') + '@email.com',
            phone: '+351 9' + Math.floor(Math.random() * 90000000 + 10000000),
            route: route,
            flightNumber: airline + Math.floor(Math.random() * 9000 + 1000),
            airline: airline,
            departureDate: departureDate,
            arrivalDate: new Date(departureDate.getTime() + (Math.random() * 12 + 2) * 60 * 60 * 1000),
            bookingDate: bookingDate,
            status: status,
            paymentStatus: paymentStatus,
            totalAmount: totalAmount,
            taxes: Math.floor(totalAmount * 0.15),
            passengers: Math.floor(Math.random() * 4) + 1,
            baggage: Math.random() > 0.5,
            checkinStatus: Math.random() > 0.6 ? 'completed' : 'pending',
            lastUpdate: new Date()
        });
    }
    
    return reservations.sort((a, b) => b.bookingDate - a.bookingDate);
}
// ====================================
// INICIALIZAÇÃO DO SERVIDOR
// ====================================

app.listen(port, () => {
    console.log(`🚀 Servidor FlightsMND rodando na porta ${port}`);
    console.log(`📡 Ambiente Amadeus: ${process.env.NODE_ENV === 'production' ? 'PRODUÇÃO' : 'TESTE'}`);
    
});