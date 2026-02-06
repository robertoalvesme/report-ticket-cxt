require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/database');
const apiController = require('./src/controllers/APIController');

const app = express();

// Conectar ao Banco
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());

// --- ROTAS ---

// 1. Dashboard Data (Já existia)
app.get('/api/dashboard', (req, res) => apiController.getDashboardData(req, res));

// 2. Rota para o Worker/Script pegar o próximo ticket pendente (Novo)
app.get('/api/tickets/pending', (req, res) => apiController.getPendingTicket(req, res));

// 3. Rota para Sync Manual (ESSA É A QUE ESTÁ FALTANDO)
// O :activityNumber é o parametro dinâmico que receberá o ID do chamado
app.post('/api/tickets/:activityNumber/sync', (req, res) => apiController.syncTicketDetails(req, res));

// Rota de Healthcheck
app.get('/', (req, res) => res.send('OCD Dashboard API Running'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});