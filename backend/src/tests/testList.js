require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Ticket = require('../models/Ticket');
const ticketUsecase = require('../usecase/TicketUsecase');
const ocdService = require('../services/OCDService');

// --- DADOS DE EXEMPLO (Do seu chamados.json) ---
const MOCK_API_RESPONSE = {
    "code": 200,
    "status": "OK.",
    "time": "15.2834s",
    "data": {
        "event_id_last": "33633557",
        "ticket_assignments": [
            {
                "event_id": "33135339",
                "event_name": "Activity assigned to engineer. BI SBL-SR...",
                "activity_number": "1-23352806592",
                "activity_severity_name": "BI",
                "queue_name": "CXT_GLOBAL",
                "assignment_group_name": null,
                "user_name": "zhoupengfei",
                "user_first_name": "Teddy",
                "user_last_name": "Zhou",
                "user_flu_name": "Teddy Zhou (zhoupengfei)",
                "customer_fl": "0050312048",
                "customer_name": "CNAM",
                "entered_time": "1764831689",
                "activity_type_name": "Break/Fix",
                "activity_skill_name": "Communication Manager"
            },
            {
                "event_id": "33144211",
                "event_name": "Activity assigned to engineer...",
                "activity_number": "1-23353624672",
                "activity_severity_name": "NBI",
                "queue_name": "CXT_GLOBAL",
                "user_name": "wang796",
                "user_flu_name": "Edison Wang (wang796)",
                "customer_name": "NRSSO_ROW- Get Sold to from Customer",
                "entered_time": "1764901875",
                "activity_type_name": "Break/Fix",
                "activity_skill_name": "CCS/SES"
            }
        ]
    }
};

const runTest = async () => {
    // 1. Conectar no Banco
    await connectDB();

    console.log('--- Iniciando Teste de Listagem ---');

    // 2. MOCKAR o Serviço (Sobrescrever a função para não chamar a API real agora)
    // Isso serve para testar se o Usecase sabe salvar no banco corretamente
    ocdService.fetchTicketAssignments = async (lastId) => {
        console.log(`[MOCK] OCDService chamado com lastId: ${lastId}`);
        console.log(`[MOCK] Retornando dados simulados...`);
        return MOCK_API_RESPONSE.data;
    };

    // 3. Executar o Usecase
    const result = await ticketUsecase.syncTickets();
    console.log('Resultado do Usecase:', result);

    // 4. Verificar se salvou no Banco
    const count = await Ticket.countDocuments();
    console.log(`Total de Tickets no Banco: ${count}`);

    const sample = await Ticket.findOne({ event_id: "33144211" });
    if (sample) {
        console.log('Ticket de teste encontrado no banco:');
        console.log(`- ID: ${sample.activity_number}`);
        console.log(`- Cliente: ${sample.customer_name}`);
        console.log(`- Status (upsert): Sucesso`);
    } else {
        console.error('ERRO: Ticket não encontrado no banco.');
    }

    // 5. Encerrar
    await mongoose.connection.close();
    console.log('Conexão encerrada.');
};

runTest();