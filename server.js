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

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

app.get('/admin/users', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/users.html'));
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
// INICIALIZAÇÃO DO SERVIDOR
// ====================================

app.listen(port, () => {
    console.log(`🚀 Servidor FlightsMND rodando na porta ${port}`);
    console.log(`📡 Ambiente Amadeus: ${process.env.NODE_ENV === 'production' ? 'PRODUÇÃO' : 'TESTE'}`);
    
});