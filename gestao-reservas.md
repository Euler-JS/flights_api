# 📋 Guia de Integração - Gestão de Usuários

## 🗂️ **1. Criar os Novos Arquivos**

### **public/admin/users.html**
Copie o conteúdo completo do arquivo HTML da gestão de usuários.

### **public/admin/css/users.css**
Copie o CSS específico para a página de usuários.

### **public/admin/js/users.js**
Copie o JavaScript com todas as funcionalidades interativas.

## ⚙️ **2. Atualizar o server.js**

Adicione todas as rotas e funções do arquivo "server-users-routes" ao seu `server.js` existente.

**⚠️ Importante:** Adicione as novas rotas **APÓS** as rotas existentes, antes da inicialização do servidor.

## 🔗 **3. Atualizar a Navegação**

### **Modificar o arquivo `public/admin/index.html`:**

Encontre a seção do header e adicione a navegação:

```html
<nav class="bg-white shadow-lg border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-8">
                <h1 class="text-2xl font-bold text-gray-900">FlightsMND Admin</h1>
                <div class="flex space-x-6">
                    <a href="index.html" class="nav-link active">
                        <i data-lucide="bar-chart-3" class="w-5 h-5"></i>
                        <span>Dashboard</span>
                    </a>
                    <a href="users.html" class="nav-link">
                        <i data-lucide="users" class="w-5 h-5"></i>
                        <span>Usuários</span>
                    </a>
                    <a href="#" class="nav-link">
                        <i data-lucide="plane" class="w-5 h-5"></i>
                        <span>Reservas</span>
                    </a>
                </div>
            </div>
            <div class="flex items-center space-x-4">
                <div class="relative">
                    <i data-lucide="bell" class="w-6 h-6 text-gray-600 cursor-pointer"></i>
                    <span class="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">3</span>
                </div>
                <div class="text-sm text-gray-600">
                    <i data-lucide="calendar" class="w-4 h-4 inline mr-1"></i>
                    <span id="currentDate"></span>
                </div>
            </div>
        </div>
    </div>
</nav>
```

### **Adicione o CSS da navegação ao `dashboard.css`:**

```css
/* Adicionar ao final do arquivo dashboard.css */
.nav-link {
    display: flex;
    align-items: center;
    padding: 0.5rem 1rem;
    text-decoration: none;
    color: #6b7280;
    border-radius: 0.5rem;
    transition: all 0.2s ease;
    font-weight: 500;
}

.nav-link:hover {
    color: #374151;
    background-color: #f3f4f6;
}

.nav-link.active {
    color: #3b82f6;
    background-color: #dbeafe;
}

.nav-link i {
    margin-right: 0.5rem;
}
```

## 🚀 **4. Testar a Instalação**

1. **Reinicie o servidor:**
```bash
node server.js
```

2. **Acesse as páginas:**
- Dashboard principal: `http://localhost:3000/admin`
- Gestão de usuários: `http://localhost:3000/admin/users`

3. **Teste as funcionalidades:**
- ✅ Navegação entre páginas
- ✅ Filtros e busca de usuários
- ✅ Paginação
- ✅ Modais de detalhes
- ✅ Gráficos e métricas

## 📊 **5. Funcionalidades Implementadas**

### **Métricas de Usuários:**
✅ Usuários ativos (últimos 30 dias)  
✅ Novos registros (esta semana)  
✅ Tickets de suporte abertos  
✅ Problemas de pagamento  

### **Gestão de Usuários:**
✅ Lista completa com paginação  
✅ Busca por nome/email  
✅ Filtros por status  
✅ Ordenação por colunas  
✅ Detalhes completos do usuário  

### **Suporte ao Cliente:**
✅ Visualização de tickets  
✅ Sistema de respostas  
✅ Resolução de tickets  
✅ Histórico de interações  

### **Analytics:**
✅ Gráfico de crescimento de usuários  
✅ Top 5 clientes  
✅ Estatísticas de engajamento  

### **Ações Administrativas:**
✅ Editar informações de usuário  
✅ Criar novos usuários  
✅ Exportar dados  
✅ Gestão de status  

## 🔗 **6. Integração com Dados Reais**

### **Para conectar com banco de dados, modifique as funções no `server.js`:**

#### **Exemplo com MySQL:**
```javascript
async function getUsersMetricsFromDB(period) {
    const db = getDatabase();
    
    const activeUsers = await db.query(`
        SELECT COUNT(DISTINCT id) as count
        FROM users 
        WHERE last_activity >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND status = 'active'
    `);
    
    return {
        activeUsers: activeUsers[0].count,
        // ... outras métricas
    };
}
```

#### **Exemplo com MongoDB:**
```javascript
async function getUsersMetricsFromMongo(period) {
    const db = getMongoDatabase();
    
    const activeUsers = await db.collection('users').countDocuments({
        lastActivity: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        status: 'active'
    });
    
    return {
        activeUsers,
        // ... outras métricas
    };
}
```

## 🔐 **7. Segurança e Autenticação**

### **Para proteger as rotas admin, adicione middleware:**

```javascript
// Middleware de autenticação
function requireAdminAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token necessário' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
}

// Aplicar em todas as rotas admin
app.get('/api/admin/*', requireAdminAuth);
app.post('/api/admin/*', requireAdminAuth);
```

## 📱 **8. Responsividade**

A interface foi otimizada para:
- ✅ **Desktop** (1920px+)
- ✅ **Tablet** (768px - 1024px)
- ✅ **Mobile** (320px - 768px)

## 🎨 **9. Personalização**

### **Cores do tema (modificar no CSS):**
```css
:root {
    --primary-color: #3b82f6;
    --success-color: #10b981;
    --warning-color: #f59e0b;
    --danger-color: #ef4444;
    --gray-50: #f9fafb;
    --gray-900: #111827;
}
```

### **Logo da empresa:**
Substitua o texto "FlightsMND Admin" por sua logo:
```html
<img src="/assets/logo.png" alt="Sua Empresa" class="h-8">
```

## 🔧 **10. APIs Disponíveis**

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/admin/users-metrics` | GET | Métricas gerais |
| `/api/admin/users` | GET | Lista de usuários |
| `/api/admin/users/:id` | GET | Detalhes do usuário |
| `/api/admin/users/:id` | PUT | Atualizar usuário |
| `/api/admin/users` | POST | Criar usuário |
| `/api/admin/users/:id` | DELETE | Deletar usuário |
| `/api/admin/top-customers` | GET | Top clientes |
| `/api/admin/users-growth` | GET | Dados de crescimento |
| `/api/admin/support-tickets` | GET | Tickets de suporte |
| `/api/admin/users/export` | GET | Exportar usuários |

## 🆘 **11. Troubleshooting**

### **Problema: Página de usuários não carrega**
- Verifique se o arquivo `users.html` está na pasta correta
- Confirme se as rotas foram adicionadas ao `server.js`
- Verifique o console do navegador para erros

### **Problema: Gráficos não aparecem**
- Confirme se o Chart.js está carregando
- Verifique se não há erros JavaScript no console

### **Problema: Modais não funcionam**
- Verifique se o Lucide Icons está carregando
- Confirme se o arquivo `users.js` foi incluído

### **Problema: Filtros não funcionam**
- Abra o console do navegador
- Verifique se há erros no JavaScript
- Confirme se os event listeners estão sendo configurados

## 🎯 **12. Próximos Passos**

Após a integração bem-sucedida:

1. **Conectar com banco de dados real**
2. **Implementar autenticação completa**
3. **Adicionar notificações em tempo real**
4. **Criar seção de reservas**
5. **Implementar relatórios avançados**
6. **Adicionar sistema de permissões**

---

🎉 **Pronto! Sua gestão de usuários está funcionando!**

Acesse: `http://localhost:3000/admin/users`

**Próxima etapa:** Implementar a seção de **Gestão de Reservas** ou conectar com dados reais!