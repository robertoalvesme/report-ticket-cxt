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

// Rotas
app.get('/api/dashboard', (req, res) => apiController.getDashboardData(req, res));

// Rota de Healthcheck
app.get('/', (req, res) => res.send('OCD Dashboard API Running'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});