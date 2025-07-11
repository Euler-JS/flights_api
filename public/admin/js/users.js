class UsersManagement {
    constructor() {
        this.users = [];
        this.filteredUsers = [];
        this.currentPage = 1;
        this.usersPerPage = 10;
        this.sortColumn = 'name';
        this.sortDirection = 'asc';
        this.searchTerm = '';
        this.statusFilter = 'all';
        
        this.init();
    }

    async init() {
        this.setCurrentDate();
        this.setupEventListeners();
        await this.loadUsersData();
        this.hideLoading();
        this.showContent();
    }

    setCurrentDate() {
        const currentDateElement = document.getElementById('currentDate');
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        currentDateElement.textContent = now.toLocaleDateString('pt-BR', options);
    }

    setupEventListeners() {
        // Search and filters
        document.getElementById('searchUsers').addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.filterUsers();
        });

        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.statusFilter = e.target.value;
            this.filterUsers();
        });

        // Pagination
        document.getElementById('prevPage').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderUsers();
            }
        });

        document.getElementById('nextPage').addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredUsers.length / this.usersPerPage);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderUsers();
            }
        });

        // Select all checkbox
        document.getElementById('selectAll').addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('tbody input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
        });
    }

    async loadUsersData() {
        try {
            // Simular delay de carregamento
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Por enquanto usando dados fictícios
            const data = await this.getMockUsersData();
            
            this.users = data.users;
            this.filteredUsers = [...this.users];
            
            this.updateMetrics(data.metrics);
            // this.createUserGrowthChart(data.growthData);
            this.renderTopCustomers(data.topCustomers);
            this.renderUsers();
            
        } catch (error) {
            console.error('Erro ao carregar dados dos usuários:', error);
            this.showError('Erro ao carregar dados. Tente novamente.');
        }
    }

    async getMockUsersData() {
        return {
            metrics: {
                activeUsers: 2847,
                newUsers: 156,
                openTickets: 23,
                paymentIssues: 7
            },
            growthData: [
                { day: '01', users: 2650, newUsers: 12 },
                { day: '02', users: 2671, newUsers: 21 },
                { day: '03', users: 2695, newUsers: 24 },
                { day: '04', users: 2718, newUsers: 23 },
                { day: '05', users: 2742, newUsers: 24 },
                { day: '06', users: 2756, newUsers: 14 },
                { day: '07', users: 2763, newUsers: 7 },
                { day: '08', users: 2778, newUsers: 15 },
                { day: '09', users: 2795, newUsers: 17 },
                { day: '10', users: 2812, newUsers: 17 },
                { day: '11', users: 2825, newUsers: 13 },
                { day: '12', users: 2834, newUsers: 9 },
                { day: '13', users: 2841, newUsers: 7 },
                { day: '14', users: 2847, newUsers: 6 }
            ],
            topCustomers: [
                { name: 'Maria Silva', email: 'maria.silva@email.com', bookings: 24, totalSpent: 28500, avatar: 'MS' },
                { name: 'João Santos', email: 'joao.santos@email.com', bookings: 19, totalSpent: 22300, avatar: 'JS' },
                { name: 'Ana Costa', email: 'ana.costa@email.com', bookings: 17, totalSpent: 19800, avatar: 'AC' },
                { name: 'Pedro Lima', email: 'pedro.lima@email.com', bookings: 15, totalSpent: 18400, avatar: 'PL' },
                { name: 'Sofia Mendes', email: 'sofia.mendes@email.com', bookings: 14, totalSpent: 16900, avatar: 'SM' }
            ],
            users: this.generateMockUsers()
        };
    }

    generateMockUsers() {
        const names = [
            'Maria Silva', 'João Santos', 'Ana Costa', 'Pedro Lima', 'Sofia Mendes',
            'Carlos Oliveira', 'Fernanda Rocha', 'Miguel Torres', 'Inês Ferreira', 'Rui Cardoso',
            'Catarina Lopes', 'António Martins', 'Teresa Sousa', 'José Pereira', 'Marta Alves',
            'Hugo Dias', 'Rita Gomes', 'Paulo Ribeiro', 'Carla Nunes', 'Diogo Correia',
            'Luísa Monteiro', 'Bruno Fonseca', 'Sandra Pinto', 'Nuno Teixeira', 'Patrícia Cruz'
        ];

        const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'sapo.pt'];
        const statuses = ['active', 'inactive', 'payment_issues', 'support_pending', 'vip'];
        
        const users = [];
        
        for (let i = 0; i < 150; i++) {
            const name = names[Math.floor(Math.random() * names.length)];
            const email = name.toLowerCase()
                .replace(/ /g, '.')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') + 
                Math.floor(Math.random() * 100) + 
                '@' + domains[Math.floor(Math.random() * domains.length)];
            
            const bookings = Math.floor(Math.random() * 25);
            const totalSpent = bookings * (Math.floor(Math.random() * 2000) + 500);
            const lastActivity = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
            
            users.push({
                id: i + 1,
                name: name,
                email: email,
                status: statuses[Math.floor(Math.random() * statuses.length)],
                bookings: bookings,
                totalSpent: totalSpent,
                lastActivity: lastActivity,
                registrationDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
                phone: '+351 9' + Math.floor(Math.random() * 90000000 + 10000000),
                country: Math.random() > 0.7 ? 'Brasil' : 'Portugal',
                avatar: name.split(' ').map(n => n[0]).join('').toUpperCase()
            });
        }
        
        return users;
    }

    updateMetrics(metrics) {
        // Animar valores
        this.animateValue('activeUsers', 0, metrics.activeUsers, 2000);
        this.animateValue('newUsers', 0, metrics.newUsers, 1500);
        this.animateValue('openTickets', 0, metrics.openTickets, 1200);
        this.animateValue('paymentIssues', 0, metrics.paymentIssues, 1000);
    }

    animateValue(elementId, start, end, duration) {
        const element = document.getElementById(elementId);
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const value = start + (end - start) * easeOutQuart;
            
            element.textContent = Math.floor(value).toLocaleString();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    createUserGrowthChart(growthData) {
        const ctx = document.getElementById('userGrowthChart').getContext('2d');
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: growthData.map(item => `Dia ${item.day}`),
                datasets: [
                    {
                        label: 'Usuários Totais',
                        data: growthData.map(item => item.users),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Novos Usuários',
                        data: growthData.map(item => item.newUsers),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#374151',
                        bodyColor: '#374151',
                        borderColor: '#E5E7EB',
                        borderWidth: 1,
                        cornerRadius: 8
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left'
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }

    renderTopCustomers(topCustomers) {
        const container = document.getElementById('topCustomers');
        container.innerHTML = '';
        
        topCustomers.forEach((customer, index) => {
            const customerElement = document.createElement('div');
            customerElement.className = 'top-customer-card';
            customerElement.innerHTML = `
                <div class="customer-rank">${index + 1}</div>
                <div class="user-avatar">${customer.avatar}</div>
                <div class="customer-info ml-3">
                    <div class="customer-name">${customer.name}</div>
                    <div class="customer-stats">${customer.bookings} reservas • ${customer.email}</div>
                </div>
                <div class="customer-value">
                    ${customer.totalSpent.toLocaleString()} MT
                </div>
            `;
            container.appendChild(customerElement);
        });
    }

    filterUsers() {
        this.filteredUsers = this.users.filter(user => {
            const matchesSearch = user.name.toLowerCase().includes(this.searchTerm) ||
                                user.email.toLowerCase().includes(this.searchTerm);
            
            const matchesStatus = this.statusFilter === 'all' || user.status === this.statusFilter;
            
            return matchesSearch && matchesStatus;
        });
        
        this.currentPage = 1;
        this.renderUsers();
    }

    sortUsers(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        this.filteredUsers.sort((a, b) => {
            let aValue = a[column];
            let bValue = b[column];
            
            if (column === 'lastActivity' || column === 'registrationDate') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }
            
            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }
            
            if (aValue < bValue) return this.sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        
        this.renderUsers();
    }

    renderUsers() {
        const startIndex = (this.currentPage - 1) * this.usersPerPage;
        const endIndex = startIndex + this.usersPerPage;
        const usersToShow = this.filteredUsers.slice(startIndex, endIndex);
        
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';
        
        usersToShow.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <input type="checkbox" class="rounded border-gray-300" value="${user.id}">
                </td>
                <td>
                    <div class="flex items-center">
                        <div class="user-avatar mr-3">${user.avatar}</div>
                        <div>
                            <div class="font-medium text-gray-900">${user.name}</div>
                            <div class="text-sm text-gray-500">ID: ${user.id}</div>
                        </div>
                    </div>
                </td>
                <td class="text-sm text-gray-900">${user.email}</td>
                <td>
                    <span class="status-badge ${user.status}">${this.getStatusText(user.status)}</span>
                </td>
                <td class="text-sm text-gray-900">${user.bookings}</td>
                <td class="text-sm font-medium text-gray-900">${user.totalSpent.toLocaleString()} MT</td>
                <td class="text-sm text-gray-500">${this.formatDate(user.lastActivity)}</td>
                <td>
                    <button class="action-btn view" onclick="viewUser(${user.id})">
                        <i data-lucide="eye"></i>
                        Ver
                    </button>
                    <button class="action-btn edit" onclick="editUser(${user.id})">
                        <i data-lucide="edit"></i>
                        Editar
                    </button>
                    ${user.status === 'support_pending' ? 
                        `<button class="action-btn support" onclick="viewSupportTicket(${user.id})">
                            <i data-lucide="message-circle"></i>
                            Suporte
                        </button>` : ''
                    }
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // Reinicializar ícones Lucide
        if (window.lucide) {
            lucide.createIcons();
        }
        
        this.updatePagination();
    }

    getStatusText(status) {
        const statusTexts = {
            'active': 'Ativo',
            'inactive': 'Inativo',
            'payment_issues': 'Prob. Pagamento',
            'support_pending': 'Suporte Pendente',
            'vip': 'VIP'
        };
        return statusTexts[status] || status;
    }

    formatDate(date) {
        const now = new Date();
        const diffTime = Math.abs(now - new Date(date));
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Hoje';
        if (diffDays === 2) return 'Ontem';
        if (diffDays <= 7) return `${diffDays} dias atrás`;
        
        return new Date(date).toLocaleDateString('pt-BR');
    }

    updatePagination() {
        const totalUsers = this.filteredUsers.length;
        const totalPages = Math.ceil(totalUsers / this.usersPerPage);
        const startIndex = (this.currentPage - 1) * this.usersPerPage;
        const endIndex = Math.min(startIndex + this.usersPerPage, totalUsers);
        
        // Update info text
        document.getElementById('showingFrom').textContent = startIndex + 1;
        document.getElementById('showingTo').textContent = endIndex;
        document.getElementById('totalUsers').textContent = totalUsers;
        
        // Update buttons
        document.getElementById('prevPage').disabled = this.currentPage === 1;
        document.getElementById('nextPage').disabled = this.currentPage === totalPages;
        
        // Generate page numbers
        const pageNumbers = document.getElementById('pageNumbers');
        pageNumbers.innerHTML = '';
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `page-number ${i === this.currentPage ? 'active' : ''}`;
                pageBtn.textContent = i;
                pageBtn.onclick = () => {
                    this.currentPage = i;
                    this.renderUsers();
                };
                pageNumbers.appendChild(pageBtn);
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.className = 'px-2';
                pageNumbers.appendChild(ellipsis);
            }
        }
    }

    hideLoading() {
        document.getElementById('loadingState').classList.add('hidden');
    }

    showContent() {
        document.getElementById('usersContent').classList.remove('hidden');
    }

    showError(message) {
        console.error(message);
        this.hideLoading();
        alert(message);
    }
}

// Global functions for actions
function sortTable(column) {
    if (window.usersManager) {
        window.usersManager.sortUsers(column);
    }
}

function viewUser(userId) {
    const user = window.usersManager.users.find(u => u.id === userId);
    if (!user) return;
    
    const modal = document.getElementById('userDetailModal');
    const content = document.getElementById('userDetailContent');
    
    content.innerHTML = `
        <div class="user-detail-section">
            <div class="user-detail-title">Informações Pessoais</div>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Nome Completo</div>
                    <div class="detail-value">${user.name}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Email</div>
                    <div class="detail-value">${user.email}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Telefone</div>
                    <div class="detail-value">${user.phone}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">País</div>
                    <div class="detail-value">${user.country}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Status</div>
                    <div class="detail-value">
                        <span class="status-badge ${user.status}">${window.usersManager.getStatusText(user.status)}</span>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Data de Registro</div>
                    <div class="detail-value">${new Date(user.registrationDate).toLocaleDateString('pt-BR')}</div>
                </div>
            </div>
        </div>
        
        <div class="user-detail-section">
            <div class="user-detail-title">Estatísticas de Viagem</div>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Total de Reservas</div>
                    <div class="detail-value">${user.bookings}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Valor Total Gasto</div>
                    <div class="detail-value">${user.totalSpent.toLocaleString()} MT</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Ticket Médio</div>
                    <div class="detail-value">${user.bookings > 0 ? Math.round(user.totalSpent / user.bookings).toLocaleString() : '0'} MT</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Última Atividade</div>
                    <div class="detail-value">${window.usersManager.formatDate(user.lastActivity)}</div>
                </div>
            </div>
        </div>
        
        <div class="user-detail-section">
            <div class="user-detail-title">Histórico de Reservas</div>
            <div class="space-y-3">
                ${generateBookingHistory(user)}
            </div>
        </div>
        
        <div class="flex justify-end space-x-3 mt-6">
            <button class="btn btn-secondary" onclick="closeUserDetailModal()">Fechar</button>
            <button class="btn btn-primary" onclick="editUser(${user.id})">Editar Usuário</button>
            ${user.status === 'support_pending' ? 
                `<button class="btn btn-danger" onclick="viewSupportTicket(${user.id})">Ver Ticket</button>` : 
                `<button class="btn btn-success" onclick="createSupportTicket(${user.id})">Criar Ticket</button>`
            }
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function generateBookingHistory(user) {
    const bookings = [];
    for (let i = 0; i < Math.min(user.bookings, 5); i++) {
        const routes = ['LIS-MAD', 'OPO-PAR', 'LIS-LON', 'FAO-BCN', 'LIS-NYC'];
        const route = routes[Math.floor(Math.random() * routes.length)];
        const date = new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000);
        const price = Math.floor(Math.random() * 800) + 200;
        
        bookings.push(`
            <div class="booking-item">
                <div class="flex-1">
                    <div class="booking-route">${route}</div>
                    <div class="booking-date">${date.toLocaleDateString('pt-BR')}</div>
                </div>
                <div class="booking-price">${price} MT</div>
            </div>
        `);
    }
    
    return bookings.join('');
}

function editUser(userId) {
    // Implementar modal de edição
    alert(`Editar usuário ${userId} - Funcionalidade em desenvolvimento`);
}

function viewSupportTicket(userId) {
    const modal = document.getElementById('supportTicketModal');
    const content = document.getElementById('supportTicketContent');
    
    content.innerHTML = `
        <div class="space-y-4">
            <div class="ticket-message user">
                <div class="ticket-meta">
                    <span class="font-medium">Cliente</span>
                    <span>Hoje, 14:32</span>
                </div>
                <div class="ticket-content">
                    Olá, estou com problemas para fazer o check-in online. O sistema diz que há um erro no meu cartão de embarque.
                </div>
            </div>
            
            <div class="ticket-message admin">
                <div class="ticket-meta">
                    <span class="font-medium">Suporte FlightsMND</span>
                    <span>Hoje, 14:45</span>
                </div>
                <div class="ticket-content">
                    Olá! Verificamos a sua reserva e encontramos o problema. O check-in está bloqueado devido a uma pendência no pagamento. 
                    Pode verificar o seu método de pagamento?
                </div>
            </div>
            
            <div class="ticket-message user">
                <div class="ticket-meta">
                    <span class="font-medium">Cliente</span>
                    <span>Hoje, 15:12</span>
                </div>
                <div class="ticket-content">
                    Obrigado! Já atualizei o cartão. Posso tentar novamente?
                </div>
            </div>
        </div>
        
        <div class="mt-6">
            <div class="form-group">
                <label class="form-label">Responder ao cliente:</label>
                <textarea class="form-textarea" placeholder="Digite sua resposta aqui..."></textarea>
            </div>
            <div class="flex justify-end space-x-3 mt-4">
                <button class="btn btn-secondary" onclick="closeSupportTicketModal()">Fechar</button>
                <button class="btn btn-success">Enviar Resposta</button>
                <button class="btn btn-primary">Resolver Ticket</button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function createSupportTicket(userId) {
    alert(`Criar ticket para usuário ${userId} - Funcionalidade em desenvolvimento`);
}

function closeUserDetailModal() {
    document.getElementById('userDetailModal').classList.add('hidden');
}

function closeSupportTicketModal() {
    document.getElementById('supportTicketModal').classList.add('hidden');
}

function showAddUserModal() {
    alert('Adicionar novo usuário - Funcionalidade em desenvolvimento');
}

function exportUsers() {
    alert('Exportar usuários - Funcionalidade em desenvolvimento');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.usersManager = new UsersManagement();
});