class ReservationsManagement {
    constructor() {
        this.reservations = [];
        this.filteredReservations = [];
        this.currentPage = 1;
        this.reservationsPerPage = 10;
        this.sortColumn = 'bookingCode';
        this.sortDirection = 'desc';
        this.searchTerm = '';
        this.statusFilter = 'all';
        this.periodFilter = 'all';
        this.charts = {};
        
        this.init();
    }

    async init() {
        this.setCurrentDate();
        this.setupEventListeners();
        await this.loadReservationsData();
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
        document.getElementById('searchReservations').addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.filterReservations();
        });

        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.statusFilter = e.target.value;
            this.filterReservations();
        });

        document.getElementById('periodFilter').addEventListener('change', (e) => {
            this.periodFilter = e.target.value;
            this.filterReservations();
        });

        // Pagination
        document.getElementById('prevPageRes').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderReservations();
            }
        });

        document.getElementById('nextPageRes').addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredReservations.length / this.reservationsPerPage);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderReservations();
            }
        });

        // Select all checkbox
        document.getElementById('selectAllReservations').addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('tbody input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
        });
    }

    async loadReservationsData() {
        try {
            // Simular delay de carregamento
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const data = await this.getMockReservationsData();
            
            this.reservations = data.reservations;
            this.filteredReservations = [...this.reservations];
            
            this.updateMetrics(data.metrics);
            this.createCharts(data.chartData);
            this.renderFlightAlerts(data.flightAlerts);
            this.renderPendingRefunds(data.pendingRefunds);
            this.renderReservations();
            
        } catch (error) {
            console.error('Erro ao carregar dados das reservas:', error);
            this.showError('Erro ao carregar dados. Tente novamente.');
        }
    }

    async getMockReservationsData() {
        return {
            metrics: {
                todayReservations: 59,
                pendingPayments: 12,
                cancellations: 8,
                reservationsRevenue: 1250000
            },
            chartData: {
                popularRoutes: [
                    { route: 'LIS-MAD', bookings: 145, revenue: 89000 },
                    { route: 'OPO-PAR', bookings: 98, revenue: 78000 },
                    { route: 'LIS-LON', bookings: 87, revenue: 95000 },
                    { route: 'FAO-BCN', bookings: 76, revenue: 45000 },
                    { route: 'LIS-NYC', bookings: 65, revenue: 125000 }
                ],
                airlines: [
                    { name: 'TAP', bookings: 234, percentage: 35 },
                    { name: 'Ryanair', bookings: 189, percentage: 28 },
                    { name: 'Lufthansa', bookings: 123, percentage: 18 },
                    { name: 'Air France', bookings: 87, percentage: 13 },
                    { name: 'Outros', bookings: 42, percentage: 6 }
                ]
            },
            flightAlerts: [
                { flightNumber: 'TP1234', status: 'Atrasado', delay: '45 min', route: 'LIS-MAD' },
                { flightNumber: 'FR7892', status: 'Cancelado', delay: '-', route: 'OPO-PAR' },
                { flightNumber: 'LH4567', status: 'Atrasado', delay: '20 min', route: 'LIS-FRA' }
            ],
            pendingRefunds: [
                { bookingCode: 'MND789', passenger: 'Ana Silva', amount: 450, days: 3 },
                { bookingCode: 'MND456', passenger: 'Carlos Santos', amount: 890, days: 7 },
                { bookingCode: 'MND123', passenger: 'Maria Costa', amount: 320, days: 2 }
            ],
            reservations: this.generateMockReservations()
        };
    }

    generateMockReservations() {
        const passengers = [
            'Maria Silva', 'João Santos', 'Ana Costa', 'Pedro Lima', 'Sofia Mendes',
            'Carlos Oliveira', 'Fernanda Rocha', 'Miguel Torres', 'Inês Ferreira', 'Rui Cardoso',
            'Catarina Lopes', 'António Martins', 'Teresa Sousa', 'José Pereira', 'Marta Alves'
        ];

        const routes = [
            { from: 'LIS', to: 'MAD', fromName: 'Lisboa', toName: 'Madrid' },
            { from: 'OPO', to: 'PAR', fromName: 'Porto', toName: 'Paris' },
            { from: 'LIS', to: 'LON', fromName: 'Lisboa', toName: 'Londres' },
            { from: 'FAO', to: 'BCN', fromName: 'Faro', toName: 'Barcelona' },
            { from: 'LIS', to: 'NYC', fromName: 'Lisboa', toName: 'Nova York' },
            { from: 'OPO', to: 'FRA', fromName: 'Porto', toName: 'Frankfurt' },
            { from: 'LIS', to: 'ROM', fromName: 'Lisboa', toName: 'Roma' }
        ];

        const airlines = ['TP', 'FR', 'LH', 'AF', 'BA', 'KL'];
        const statuses = ['confirmed', 'pending', 'cancelled', 'refunded'];
        const paymentStatuses = ['paid', 'pending', 'failed', 'refunded'];
        
        const reservations = [];
        
        for (let i = 0; i < 200; i++) {
            const passenger = passengers[Math.floor(Math.random() * passengers.length)];
            const route = routes[Math.floor(Math.random() * routes.length)];
            const airline = airlines[Math.floor(Math.random() * airlines.length)];
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const paymentStatus = paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)];
            
            const bookingDate = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000);
            const departureDate = new Date(bookingDate.getTime() + Math.random() * 120 * 24 * 60 * 60 * 1000);
            
            const flightNumber = airline + Math.floor(Math.random() * 9000 + 1000);
            const totalAmount = Math.floor(Math.random() * 1500) + 200;
            
            reservations.push({
                id: i + 1,
                bookingCode: 'MND' + (1000 + i).toString(),
                passenger: passenger,
                email: passenger.toLowerCase().replace(/ /g, '.') + '@email.com',
                phone: '+351 9' + Math.floor(Math.random() * 90000000 + 10000000),
                route: route,
                flightNumber: flightNumber,
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
                seatPreference: Math.random() > 0.7 ? 'Window' : Math.random() > 0.5 ? 'Aisle' : 'Any',
                specialRequests: Math.random() > 0.8 ? 'Vegetarian meal' : null,
                checkinStatus: Math.random() > 0.6 ? 'completed' : 'pending',
                lastUpdate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
            });
        }
        
        return reservations.sort((a, b) => b.bookingDate - a.bookingDate);
    }

    updateMetrics(metrics) {
        // Animar valores
        this.animateValue('todayReservations', 0, metrics.todayReservations, 2000);
        this.animateValue('pendingPayments', 0, metrics.pendingPayments, 1500);
        this.animateValue('cancellations', 0, metrics.cancellations, 1200);
        this.animateValue('reservationsRevenue', 0, metrics.reservationsRevenue, 2500, 
            (value) => `${this.formatNumber(value)} MT`);

        // Atualizar contadores de status
        this.updateStatusCounts();
    }

    updateStatusCounts() {
        const counts = this.reservations.reduce((acc, reservation) => {
            acc[reservation.status] = (acc[reservation.status] || 0) + 1;
            return acc;
        }, {});

        document.getElementById('confirmedCount').textContent = counts.confirmed || 0;
        document.getElementById('pendingCount').textContent = counts.pending || 0;
        document.getElementById('cancelledCount').textContent = counts.cancelled || 0;
    }

    animateValue(elementId, start, end, duration, formatter = (value) => value.toString()) {
        const element = document.getElementById(elementId);
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const value = start + (end - start) * easeOutQuart;
            
            element.textContent = formatter(Math.floor(value));
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    createCharts(chartData) {
        // this.createPopularRoutesChart(chartData.popularRoutes);
        // this.createAirlinesChart(chartData.airlines);
    }

    createPopularRoutesChart(routesData) {
        const ctx = document.getElementById('popularRoutesChart').getContext('2d');
        
        if (this.charts.popularRoutes) {
            this.charts.popularRoutes.destroy();
        }

        this.charts.popularRoutes = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: routesData.map(item => item.route),
                datasets: [{
                    label: 'Reservas',
                    data: routesData.map(item => item.bookings),
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#374151',
                        bodyColor: '#374151',
                        borderColor: '#E5E7EB',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const route = routesData[context.dataIndex];
                                return [
                                    `Reservas: ${context.parsed.y}`,
                                    `Receita: ${route.revenue.toLocaleString()} MT`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#F3F4F6',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6B7280',
                            font: { size: 11 }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#6B7280',
                            font: { size: 11 }
                        }
                    }
                }
            }
        });
    }

    createAirlinesChart(airlinesData) {
        const ctx = document.getElementById('airlinesChart').getContext('2d');
        
        if (this.charts.airlines) {
            this.charts.airlines.destroy();
        }

        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

        this.charts.airlines = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: airlinesData.map(item => item.name),
                datasets: [{
                    data: airlinesData.map(item => item.bookings),
                    backgroundColor: colors,
                    borderColor: '#ffffff',
                    borderWidth: 3,
                    hoverBorderWidth: 4,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: { size: 11, weight: '500' },
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => {
                                        const percentage = airlinesData[i].percentage;
                                        return {
                                            text: `${label} (${percentage}%)`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            strokeStyle: data.datasets[0].borderColor,
                                            lineWidth: data.datasets[0].borderWidth,
                                            pointStyle: 'circle',
                                            hidden: false,
                                            index: i
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#374151',
                        bodyColor: '#374151',
                        borderColor: '#E5E7EB',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const percentage = airlinesData[context.dataIndex].percentage;
                                return `${label}: ${value} reservas (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    renderFlightAlerts(alerts) {
        const container = document.getElementById('flightAlerts');
        container.innerHTML = '';
        
        if (alerts.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500">Nenhum alerta no momento</p>';
            return;
        }
        
        alerts.forEach(alert => {
            const alertElement = document.createElement('div');
            alertElement.className = 'flight-alert-item';
            alertElement.innerHTML = `
                <div class="flex items-center justify-between">
                    <div>
                        <div class="font-medium text-sm text-gray-900">${alert.flightNumber}</div>
                        <div class="text-xs text-gray-500">${alert.route}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-xs font-medium ${alert.status === 'Cancelado' ? 'text-red-600' : 'text-orange-600'}">
                            ${alert.status}
                        </div>
                        <div class="text-xs text-gray-500">${alert.delay}</div>
                    </div>
                </div>
            `;
            container.appendChild(alertElement);
        });
    }

    renderPendingRefunds(refunds) {
        const container = document.getElementById('pendingRefunds');
        container.innerHTML = '';
        
        if (refunds.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500">Nenhum reembolso pendente</p>';
            return;
        }
        
        refunds.forEach(refund => {
            const refundElement = document.createElement('div');
            refundElement.className = 'refund-item';
            refundElement.innerHTML = `
                <div class="flex items-center justify-between">
                    <div>
                        <div class="font-medium text-sm text-gray-900">${refund.bookingCode}</div>
                        <div class="text-xs text-gray-500">${refund.passenger}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm font-medium text-gray-900">${refund.amount} MT</div>
                        <div class="text-xs text-gray-500">${refund.days} dias</div>
                    </div>
                </div>
            `;
            container.appendChild(refundElement);
        });
    }

    filterReservations() {
        this.filteredReservations = this.reservations.filter(reservation => {
            const matchesSearch = reservation.bookingCode.toLowerCase().includes(this.searchTerm) ||
                                reservation.passenger.toLowerCase().includes(this.searchTerm) ||
                                reservation.flightNumber.toLowerCase().includes(this.searchTerm);
            
            const matchesStatus = this.statusFilter === 'all' || reservation.status === this.statusFilter;
            
            let matchesPeriod = true;
            if (this.periodFilter !== 'all') {
                const now = new Date();
                const bookingDate = new Date(reservation.bookingDate);
                
                switch (this.periodFilter) {
                    case 'today':
                        matchesPeriod = bookingDate.toDateString() === now.toDateString();
                        break;
                    case 'week':
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        matchesPeriod = bookingDate >= weekAgo;
                        break;
                    case 'month':
                        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        matchesPeriod = bookingDate >= monthAgo;
                        break;
                }
            }
            
            return matchesSearch && matchesStatus && matchesPeriod;
        });
        
        this.currentPage = 1;
        this.renderReservations();
    }

    sortReservations(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        this.filteredReservations.sort((a, b) => {
            let aValue = a[column];
            let bValue = b[column];
            
            if (column === 'departureDate' || column === 'bookingDate') {
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
        
        this.renderReservations();
    }

    renderReservations() {
        const startIndex = (this.currentPage - 1) * this.reservationsPerPage;
        const endIndex = startIndex + this.reservationsPerPage;
        const reservationsToShow = this.filteredReservations.slice(startIndex, endIndex);
        
        const tbody = document.getElementById('reservationsTableBody');
        tbody.innerHTML = '';
        
        reservationsToShow.forEach(reservation => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <input type="checkbox" class="rounded border-gray-300" value="${reservation.id}">
                </td>
                <td>
                    <div class="font-medium text-gray-900">${reservation.bookingCode}</div>
                    <div class="text-sm text-gray-500">${reservation.flightNumber}</div>
                </td>
                <td>
                    <div class="font-medium text-gray-900">${reservation.passenger}</div>
                    <div class="text-sm text-gray-500">${reservation.email}</div>
                </td>
                <td>
                    <div class="font-medium text-gray-900">${reservation.route.from} → ${reservation.route.to}</div>
                    <div class="text-sm text-gray-500">${reservation.route.fromName} - ${reservation.route.toName}</div>
                </td>
                <td>
                    <div class="font-medium text-gray-900">${this.formatDate(reservation.departureDate)}</div>
                    <div class="text-sm text-gray-500">${this.formatTime(reservation.departureDate)}</div>
                </td>
                <td>
                    <span class="status-badge ${reservation.status}">${this.getStatusText(reservation.status)}</span>
                </td>
                <td>
                    <div class="font-medium text-gray-900">${reservation.totalAmount.toLocaleString()} MT</div>
                    <div class="text-sm text-gray-500">${reservation.passengers} passageiro(s)</div>
                </td>
                <td>
                    <span class="payment-badge ${reservation.paymentStatus}">${this.getPaymentStatusText(reservation.paymentStatus)}</span>
                </td>
                <td>
                    <button class="action-btn view" onclick="viewReservation(${reservation.id})">
                        <i data-lucide="eye"></i>
                        Ver
                    </button>
                    <button class="action-btn edit" onclick="editReservation(${reservation.id})">
                        <i data-lucide="edit"></i>
                        Editar
                    </button>
                    ${reservation.paymentStatus === 'pending' ? 
                        `<button class="action-btn payment" onclick="processPayment(${reservation.id})">
                            <i data-lucide="credit-card"></i>
                            Pagamento
                        </button>` : ''
                    }
                    <button class="action-btn status" onclick="checkFlightStatus('${reservation.flightNumber}', '${reservation.departureDate}')">
                        <i data-lucide="plane"></i>
                        Status
                    </button>
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
            'confirmed': 'Confirmada',
            'pending': 'Pendente',
            'cancelled': 'Cancelada',
            'refunded': 'Reembolsada'
        };
        return statusTexts[status] || status;
    }

    getPaymentStatusText(status) {
        const statusTexts = {
            'paid': 'Pago',
            'pending': 'Pendente',
            'failed': 'Falhou',
            'refunded': 'Reembolsado'
        };
        return statusTexts[status] || status;
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('pt-BR');
    }

    formatTime(date) {
        return new Date(date).toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(0) + 'K';
        }
        return num.toLocaleString();
    }

    updatePagination() {
        const totalReservations = this.filteredReservations.length;
        const totalPages = Math.ceil(totalReservations / this.reservationsPerPage);
        const startIndex = (this.currentPage - 1) * this.reservationsPerPage;
        const endIndex = Math.min(startIndex + this.reservationsPerPage, totalReservations);
        
        // Update info text
        document.getElementById('showingFromRes').textContent = startIndex + 1;
        document.getElementById('showingToRes').textContent = endIndex;
        document.getElementById('totalReservations').textContent = totalReservations;
        
        // Update buttons
        document.getElementById('prevPageRes').disabled = this.currentPage === 1;
        document.getElementById('nextPageRes').disabled = this.currentPage === totalPages;
        
        // Generate page numbers
        const pageNumbers = document.getElementById('pageNumbersRes');
        pageNumbers.innerHTML = '';
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `page-number ${i === this.currentPage ? 'active' : ''}`;
                pageBtn.textContent = i;
                pageBtn.onclick = () => {
                    this.currentPage = i;
                    this.renderReservations();
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
        document.getElementById('reservationsContent').classList.remove('hidden');
    }

    showError(message) {
        console.error(message);
        this.hideLoading();
        alert(message);
    }
}

// Global functions for actions
function sortReservations(column) {
    if (window.reservationsManager) {
        window.reservationsManager.sortReservations(column);
    }
}

function viewReservation(reservationId) {
    const reservation = window.reservationsManager.reservations.find(r => r.id === reservationId);
    if (!reservation) return;
    
    const modal = document.getElementById('reservationDetailModal');
    const content = document.getElementById('reservationDetailContent');
    
    content.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Reservation Info -->
            <div class="space-y-6">
                <div class="reservation-detail-section">
                    <h4 class="reservation-detail-title">Informações da Reserva</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <div class="detail-label">Código de Reserva</div>
                            <div class="detail-value">${reservation.bookingCode}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Status</div>
                            <div class="detail-value">
                                <span class="status-badge ${reservation.status}">${window.reservationsManager.getStatusText(reservation.status)}</span>
                            </div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Data da Reserva</div>
                            <div class="detail-value">${window.reservationsManager.formatDate(reservation.bookingDate)}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Última Atualização</div>
                            <div class="detail-value">${window.reservationsManager.formatDate(reservation.lastUpdate)}</div>
                        </div>
                    </div>
                </div>

                <div class="reservation-detail-section">
                    <h4 class="reservation-detail-title">Dados do Passageiro</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <div class="detail-label">Nome</div>
                            <div class="detail-value">${reservation.passenger}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Email</div>
                            <div class="detail-value">${reservation.email}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Telefone</div>
                            <div class="detail-value">${reservation.phone}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Passageiros</div>
                            <div class="detail-value">${reservation.passengers}</div>
                        </div>
                    </div>
                </div>

                <div class="reservation-detail-section">
                    <h4 class="reservation-detail-title">Preferências</h4>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-sm text-gray-600">Bagagem incluída:</span>
                            <span class="text-sm font-medium">${reservation.baggage ? 'Sim' : 'Não'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-sm text-gray-600">Preferência de assento:</span>
                            <span class="text-sm font-medium">${reservation.seatPreference}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-sm text-gray-600">Check-in:</span>
                            <span class="text-sm font-medium ${reservation.checkinStatus === 'completed' ? 'text-green-600' : 'text-orange-600'}">
                                ${reservation.checkinStatus === 'completed' ? 'Realizado' : 'Pendente'}
                            </span>
                        </div>
                        ${reservation.specialRequests ? `
                        <div class="flex justify-between">
                            <span class="text-sm text-gray-600">Solicitações especiais:</span>
                            <span class="text-sm font-medium">${reservation.specialRequests}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Flight Info -->
            <div class="space-y-6">
                <div class="reservation-detail-section">
                    <h4 class="reservation-detail-title">Informações do Voo</h4>
                    <div class="flight-info-card">
                        <div class="flight-route">
                            <div class="route-point">
                                <div class="route-code">${reservation.route.from}</div>
                                <div class="route-name">${reservation.route.fromName}</div>
                                <div class="route-time">${window.reservationsManager.formatTime(reservation.departureDate)}</div>
                            </div>
                            <div class="route-line">
                                <i data-lucide="plane" class="w-5 h-5 text-blue-600"></i>
                            </div>
                            <div class="route-point">
                                <div class="route-code">${reservation.route.to}</div>
                                <div class="route-name">${reservation.route.toName}</div>
                                <div class="route-time">${window.reservationsManager.formatTime(reservation.arrivalDate)}</div>
                            </div>
                        </div>
                        <div class="flight-details">
                            <div class="flight-detail">
                                <span class="detail-label">Voo:</span>
                                <span class="detail-value">${reservation.flightNumber}</span>
                            </div>
                            <div class="flight-detail">
                                <span class="detail-label">Companhia:</span>
                                <span class="detail-value">${reservation.airline}</span>
                            </div>
                            <div class="flight-detail">
                                <span class="detail-label">Data:</span>
                                <span class="detail-value">${window.reservationsManager.formatDate(reservation.departureDate)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="reservation-detail-section">
                    <h4 class="reservation-detail-title">Informações Financeiras</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <div class="detail-label">Valor Total</div>
                            <div class="detail-value font-bold text-lg">${reservation.totalAmount.toLocaleString()} MT</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Taxas</div>
                            <div class="detail-value">${reservation.taxes.toLocaleString()} MT</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Status do Pagamento</div>
                            <div class="detail-value">
                                <span class="payment-badge ${reservation.paymentStatus}">${window.reservationsManager.getPaymentStatusText(reservation.paymentStatus)}</span>
                            </div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Valor Base</div>
                            <div class="detail-value">${(reservation.totalAmount - reservation.taxes).toLocaleString()} MT</div>
                        </div>
                    </div>
                </div>

                <div class="reservation-detail-section">
                    <h4 class="reservation-detail-title">Ações Administrativas</h4>
                    <div class="grid grid-cols-2 gap-3">
                        <button class="btn btn-primary" onclick="editReservation(${reservation.id})">
                            <i data-lucide="edit" class="w-4 h-4 mr-2"></i>
                            Editar
                        </button>
                        <button class="btn btn-secondary" onclick="sendConfirmationEmail(${reservation.id})">
                            <i data-lucide="mail" class="w-4 h-4 mr-2"></i>
                            Enviar Email
                        </button>
                        ${reservation.paymentStatus === 'pending' ? `
                        <button class="btn btn-success" onclick="processPayment(${reservation.id})">
                            <i data-lucide="credit-card" class="w-4 h-4 mr-2"></i>
                            Processar Pagamento
                        </button>
                        ` : ''}
                        ${reservation.status === 'confirmed' ? `
                        <button class="btn btn-warning" onclick="cancelReservation(${reservation.id})">
                            <i data-lucide="x-circle" class="w-4 h-4 mr-2"></i>
                            Cancelar
                        </button>
                        ` : ''}
                        <button class="btn btn-info" onclick="checkFlightStatus('${reservation.flightNumber}', '${reservation.departureDate}')">
                            <i data-lucide="plane" class="w-4 h-4 mr-2"></i>
                            Status do Voo
                        </button>
                        <button class="btn btn-secondary" onclick="downloadTicket(${reservation.id})">
                            <i data-lucide="download" class="w-4 h-4 mr-2"></i>
                            Download Ticket
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
            <button class="btn btn-secondary" onclick="closeReservationDetailModal()">Fechar</button>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function editReservation(reservationId) {
    alert(`Editar reserva ${reservationId} - Funcionalidade em desenvolvimento`);
}

function processPayment(reservationId) {
    const reservation = window.reservationsManager.reservations.find(r => r.id === reservationId);
    if (!reservation) return;
    
    const modal = document.getElementById('paymentModal');
    const content = document.getElementById('paymentContent');
    
    content.innerHTML = `
        <div class="space-y-6">
            <div class="bg-gray-50 p-4 rounded-lg">
                <h4 class="font-semibold text-gray-900 mb-2">Resumo da Reserva</h4>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span>Código:</span>
                        <span class="font-medium">${reservation.bookingCode}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Passageiro:</span>
                        <span class="font-medium">${reservation.passenger}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Valor Total:</span>
                        <span class="font-bold text-lg">${reservation.totalAmount.toLocaleString()} MT</span>
                    </div>
                </div>
            </div>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Método de Pagamento</label>
                    <select class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500">
                        <option>Cartão de Crédito</option>
                        <option>Transferência Bancária</option>
                        <option>MPesa</option>
                        <option>Pagamento Manual</option>
                    </select>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                    <textarea class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" rows="3" placeholder="Observações sobre o pagamento..."></textarea>
                </div>
            </div>
            
            <div class="flex justify-end space-x-3">
                <button class="btn btn-secondary" onclick="closePaymentModal()">Cancelar</button>
                <button class="btn btn-success" onclick="confirmPayment(${reservationId})">Confirmar Pagamento</button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function checkFlightStatus(flightNumber, departureDate) {
    const modal = document.getElementById('flightStatusModal');
    const content = document.getElementById('flightStatusContent');
    
    // Simular dados de status do voo
    const statuses = ['No horário', 'Atrasado', 'Embarcando', 'Decolou', 'Cancelado'];
    const delays = ['', '15 min', '30 min', '45 min', '1h 20min'];
    
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const delay = status === 'Atrasado' ? delays[Math.floor(Math.random() * delays.length)] : '';
    
    content.innerHTML = `
        <div class="space-y-6">
            <div class="text-center">
                <h4 class="text-2xl font-bold text-gray-900 mb-2">${flightNumber}</h4>
                <p class="text-gray-600">${new Date(departureDate).toLocaleDateString('pt-BR')}</p>
            </div>
            
            <div class="bg-gray-50 p-6 rounded-lg">
                <div class="flex items-center justify-center mb-4">
                    <div class="p-4 rounded-full ${status === 'Cancelado' ? 'bg-red-100' : status === 'Atrasado' ? 'bg-orange-100' : 'bg-green-100'}">
                        <i data-lucide="${status === 'Cancelado' ? 'x-circle' : status === 'Atrasado' ? 'clock' : 'check-circle'}" 
                           class="w-8 h-8 ${status === 'Cancelado' ? 'text-red-600' : status === 'Atrasado' ? 'text-orange-600' : 'text-green-600'}"></i>
                    </div>
                </div>
                <div class="text-center">
                    <h5 class="text-xl font-semibold text-gray-900 mb-2">${status}</h5>
                    ${delay ? `<p class="text-gray-600">Atraso: ${delay}</p>` : ''}
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div class="text-center p-4 bg-gray-50 rounded-lg">
                    <h6 class="font-semibold text-gray-900 mb-2">Partida Prevista</h6>
                    <p class="text-gray-600">${new Date(departureDate).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</p>
                </div>
                <div class="text-center p-4 bg-gray-50 rounded-lg">
                    <h6 class="font-semibold text-gray-900 mb-2">Terminal</h6>
                    <p class="text-gray-600">Terminal ${Math.floor(Math.random() * 3) + 1}</p>
                </div>
            </div>
            
            <div class="flex justify-end space-x-3">
                <button class="btn btn-secondary" onclick="closeFlightStatusModal()">Fechar</button>
                <button class="btn btn-primary" onclick="refreshFlightStatus()">Atualizar</button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    
    // Reinicializar ícones Lucide
    if (window.lucide) {
        lucide.createIcons();
    }
}

function confirmPayment(reservationId) {
    alert(`Pagamento confirmado para reserva ${reservationId}`);
    closePaymentModal();
    // Atualizar status da reserva na lista
    location.reload();
}

function cancelReservation(reservationId) {
    if (confirm('Tem certeza que deseja cancelar esta reserva?')) {
        alert(`Reserva ${reservationId} cancelada`);
        location.reload();
    }
}

function sendConfirmationEmail(reservationId) {
    alert(`Email de confirmação enviado para reserva ${reservationId}`);
}

function downloadTicket(reservationId) {
    alert(`Download do ticket para reserva ${reservationId} - Funcionalidade em desenvolvimento`);
}

function closeReservationDetailModal() {
    document.getElementById('reservationDetailModal').classList.add('hidden');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
}

function closeFlightStatusModal() {
    document.getElementById('flightStatusModal').classList.add('hidden');
}

function showCreateReservationModal() {
    alert('Criar nova reserva - Funcionalidade em desenvolvimento');
}

function exportReservations() {
    alert('Exportar reservas - Funcionalidade em desenvolvimento');
}

function refreshFlightStatus() {
    alert('Atualizando status de todos os voos...');
    // Implementar atualização real via API
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.reservationsManager = new ReservationsManagement();
});