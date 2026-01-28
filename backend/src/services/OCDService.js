const axios = require('axios');
const qs = require('qs');
const https = require('https'); // Importar o módulo https nativo

class OCDService {
    constructor() {
        this.baseUrl = 'https://ocd.avaya.com/api.php';
        this.authUser = process.env.OCD_AUTH_USER;
        this.authKey = process.env.OCD_AUTH_KEY;

        // Configura um agente HTTPS que ignora erros de certificado autoassinado
        this.httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
    }

    /**
     * Busca a lista de chamados a partir de um ID de evento.
     * @param {string} lastEventId - O cursor para buscar novos eventos.
     * @returns {Promise<Object>} - O objeto 'data' da resposta da API.
     */
    async fetchTicketAssignments(lastEventId) {
        try {
            const data = qs.stringify({
                auth_user: this.authUser,
                auth_key: this.authKey,
                object: 'asod',
                method: 'ticket_assignments_by_queue',
                event_id_last: lastEventId,
                'queue_arr[]': 'CXT_GLOBAL'
            });

            const config = {
                method: 'post',
                url: this.baseUrl,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: data,
                httpsAgent: this.httpsAgent // Adiciona o agente aqui
            };

            const response = await axios(config);

            if (response.data.code !== 200) {
                throw new Error(`Erro API OCD: ${response.data.status || 'Desconhecido'}`);
            }

            return response.data.data;

        } catch (error) {
            console.error('Falha no OCDService.fetchTicketAssignments:', error.message);
            // Se quiser ver o erro completo de SSL novamente, descomente a linha abaixo
            // console.error(error);
            throw error;
        }
    }
}

module.exports = new OCDService();