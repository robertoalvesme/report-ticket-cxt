const axios = require('axios');

// Configuração
const API_URL = process.env.API_URL || 'http://app:5000/api';
const WAIT_TIME_SUCCESS = 2000; // 2 segundos entre tickets (polidez com o servidor remoto)
const WAIT_TIME_EMPTY = 60000;  // 1 minuto se não houver tickets
const WAIT_TIME_ERROR = 10000;  // 10 segundos em caso de erro de conexão

async function runWorker() {
    console.log('🚀 Worker de Sincronização Iniciado');
    console.log(`📡 Conectando em: ${API_URL}`);

    while (true) {
        try {
            // 1. Buscar próximo ticket
            // console.log('🔍 Buscando ticket pendente...');
            let ticket = null;

            try {
                const response = await axios.get(`${API_URL}/tickets/pending`);
                ticket = response.data;
            } catch (err) {
                if (err.response && err.response.status === 404) {
                    console.log(`💤 Sem tickets pendentes. Aguardando ${WAIT_TIME_EMPTY / 1000}s...`);
                    await sleep(WAIT_TIME_EMPTY);
                    continue; // Volta para o início do loop
                } else {
                    throw err; // Outros erros (ex: backend fora do ar)
                }
            }

            // 2. Processar Ticket Encontrado
            if (ticket && ticket.activity_number) {
                console.log(`⚡ Processando ticket: ${ticket.activity_number}...`);

                try {
                    await axios.post(`${API_URL}/tickets/${ticket.activity_number}/sync`);
                    console.log(`✅ Sucesso: ${ticket.activity_number} atualizado.`);
                } catch (syncError) {
                    console.error(`❌ Erro ao atualizar ${ticket.activity_number}:`, syncError.message);
                    // O backend já deve ter tratado exceções, mas aqui garantimos que o loop não para
                }

                // Pequeno delay para respirar
                await sleep(WAIT_TIME_SUCCESS);
            }

        } catch (error) {
            console.error(`🔴 Erro no Worker (Backend indisponível?): ${error.message}`);
            console.log(`Tentando novamente em ${WAIT_TIME_ERROR / 1000}s...`);
            await sleep(WAIT_TIME_ERROR);
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

runWorker();