class AdminDashboard {
    constructor() {
        this.charts = {};
        this.currentPeriod = '30d';
        this.animationDuration = 2000;
        this.init();
    }

    async init() {
        this.setCurrentDate();
        this.setupEventListeners();
        await this.loadDashboardData();
        this.hideLoding();
        this.showDashboard();
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
        // const periodSelect = document.getElementById('periodSelect');
        // periodSelect.addEventListener('change', (e) => {
        //     this.currentPeriod = e.target.value;
        //     this.loadDashboardData();
        // });
    }

    async loadDashboardData() {
        try {
            // Por enquanto usando dados fictícios
            // Em produção, fazer fetch para sua API
            const data = await this.getMockData();
            
            this.updateMetrics(data);
            this.createCharts(data);
            
        } catch (error) {
            console.error('Erro ao carregar dados do dashboard:', error);
            this.showError('Erro ao carregar dados. Tente novamente.');
        }
    }

    async getMockData() {
        // Simular delay de API
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        return {
            metrics: {
                dailyRevenue: 112000,
                dailyGrowth: 8.5,
                monthlyRevenue: 1850000,
                monthlyGrowth: 12.3,
                annualRevenue: 18500000,
                annualGrowth: 24.7,
                todayBookings: 59,
                weekBookings: 312,
                monthBookings: 1247,
                avgTicket: 1896,
                ticketGrowth: 5.2,
                conversionRate: 3.8,
                conversionGrowth: 2.1,
                totalCommissions: 89000,
                commissionsGrowth: 15.8
            },
            revenueData: [
                { day: '01', revenue: 45000, bookings: 23 },
                { day: '02', revenue: 52000, bookings: 28 },
                { day: '03', revenue: 38000, bookings: 19 },
                { day: '04', revenue: 65000, bookings: 34 },
                { day: '05', revenue: 71000, bookings: 38 },
                { day: '06', revenue: 58000, bookings: 31 },
                { day: '07', revenue: 82000, bookings: 42 },
                { day: '08', revenue: 76000, bookings: 39 },
                { day: '09', revenue: 91000, bookings: 47 },
                { day: '10', revenue: 88000, bookings: 45 },
                { day: '11', revenue: 95000, bookings: 51 },
                { day: '12', revenue: 103000, bookings: 55 },
                { day: '13', revenue: 87000, bookings: 44 },
                { day: '14', revenue: 112000, bookings: 59 }
            ],
            airlinesCommission: [
                { name: 'TAP Air Portugal', commission: 25000, percentage: 28 },
                { name: 'Lufthansa', commission: 18000, percentage: 20 },
                { name: 'Air France', commission: 15000, percentage: 17 },
                { name: 'Emirates', commission: 12000, percentage: 14 },
                { name: 'British Airways', commission: 10000, percentage: 11 },
                { name: 'Outros', commission: 9000, percentage: 10 }
            ]
        };
    }

    // Método para integrar com API real - descomente quando estiver pronto
    /*
    async getRealData() {
        const response = await fetch('/api/admin/dashboard-metrics', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // Adicionar headers de autenticação se necessário
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao buscar dados do dashboard');
        }
        
        return await response.json();
    }
    */

    updateMetrics(data) {
        const { metrics } = data;
        
        // Animar valores principais
        this.animateValue('dailyRevenue', 0, metrics.dailyRevenue, this.animationDuration, (value) => `${this.formatNumber(value)} MT`);
        this.animateValue('monthlyRevenue', 0, metrics.monthlyRevenue, this.animationDuration, (value) => `${this.formatNumber(value)} MT`);
        this.animateValue('todayBookings', 0, metrics.todayBookings, 1500, (value) => value.toString());
        this.animateValue('avgTicket', 0, metrics.avgTicket, 1800, (value) => `${this.formatNumber(value)} MT`);

        // Atualizar outros valores
        document.getElementById('annualRevenue').textContent = `${this.formatNumber(metrics.annualRevenue)} MT`;
        document.getElementById('conversionRate').textContent = `${metrics.conversionRate}%`;
        document.getElementById('totalCommissions').textContent = `${this.formatNumber(metrics.totalCommissions)} MT`;

        // Atualizar resumo
        document.getElementById('summaryToday').textContent = metrics.todayBookings;
        document.getElementById('summaryWeek').textContent = metrics.weekBookings;
        document.getElementById('summaryMonth').textContent = metrics.monthBookings;

        // Atualizar badges de crescimento
        this.updateGrowthBadges(metrics);
    }

    updateGrowthBadges(metrics) {
        const growthItems = [
            { id: 'dailyGrowth', value: metrics.dailyGrowth },
            { id: 'monthlyGrowth', value: metrics.monthlyGrowth },
            { id: 'bookingsGrowth', value: 8.2 }, // Valor fictício
            { id: 'ticketGrowth', value: metrics.ticketGrowth }
        ];

        growthItems.forEach(item => {
            const element = document.getElementById(item.id);
            const isPositive = item.value > 0;
            
            element.className = `growth-badge px-3 py-1 rounded-full text-sm font-medium ${
                isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`;
            
            const icon = isPositive ? 'trending-up' : 'trending-down';
            element.innerHTML = `
                <i data-lucide="${icon}" class="w-4 h-4 inline mr-1"></i>
                <span>${Math.abs(item.value)}%</span>
            `;
        });

        // Reinicializar ícones Lucide
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    animateValue(elementId, start, end, duration, formatter = (value) => value) {
        const element = document.getElementById(elementId);
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const value = start + (end - start) * easeOutQuart;
            
            element.textContent = formatter(Math.floor(value));
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    createCharts(data) {
        // this.createRevenueChart(data.revenueData);
        // this.createCommissionsChart(data.airlinesCommission);
    }

    createRevenueChart(revenueData) {
        const ctx = document.getElementById('revenueChart').getContext('2d');
        
        // Destruir gráfico anterior se existir
        if (this.charts.revenue) {
            this.charts.revenue.destroy();
        }

        this.charts.revenue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: revenueData.map(item => `Dia ${item.day}`),
                datasets: [
                    {
                        label: 'Receita (MT)',
                        data: revenueData.map(item => item.revenue),
                        borderColor: '#8B5CF6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#8B5CF6',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Reservas',
                        data: revenueData.map(item => item.bookings),
                        borderColor: '#06B6D4',
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#06B6D4',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12,
                                weight: '500'
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
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                if (context.dataset.label === 'Receita (MT)') {
                                    return `Receita: ${context.parsed.y.toLocaleString()} MT`;
                                }
                                return `Reservas: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#F3F4F6',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6B7280',
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: {
                            color: '#F3F4F6',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6B7280',
                            font: {
                                size: 11
                            },
                            callback: function(value) {
                                return `${value.toLocaleString()} MT`;
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                        },
                        ticks: {
                            color: '#6B7280',
                            font: {
                                size: 11
                            }
                        }
                    }
                }
            }
        });
    }

    createCommissionsChart(commissionsData) {
        const ctx = document.getElementById('commissionsChart').getContext('2d');
        
        // Destruir gráfico anterior se existir
        if (this.charts.commissions) {
            this.charts.commissions.destroy();
        }

        const colors = [
            '#8B5CF6', '#06B6D4', '#10B981', 
            '#F59E0B', '#EF4444', '#84CC16'
        ];

        this.charts.commissions = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: commissionsData.map(item => item.name),
                datasets: [{
                    data: commissionsData.map(item => item.commission),
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
                            font: {
                                size: 11,
                                weight: '500'
                            },
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => {
                                        const percentage = commissionsData[i].percentage;
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
                                const percentage = commissionsData[context.dataIndex].percentage;
                                return `${label}: ${value.toLocaleString()} MT (${percentage}%)`;
                            }
                        }
                    }
                }
            }
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

    hideLoding() {
        document.getElementById('loadingState').classList.add('hidden');
    }

    showDashboard() {
        document.getElementById('dashboardContent').classList.remove('hidden');
    }

    showError(message) {
        console.error(message);
        // Implementar UI de erro se necessário
        this.hideLoding();
        alert(message);
    }
}

// Inicializar dashboard quando DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    new AdminDashboard();
});

// Funções utilitárias globais para facilitar integração
window.dashboardUtils = {
    formatCurrency: (value) => `${value.toLocaleString()} MT`,
    formatPercentage: (value) => `${value}%`,
    formatNumber: (value) => value.toLocaleString()
};