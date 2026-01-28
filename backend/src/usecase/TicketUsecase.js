const Ticket = require('../models/Ticket');
const ocdService = require('../services/OCDService');

class TicketUsecase {

    /**
     * Orquestra a sincronização da lista de tickets.
     * 1. Descobre o último event_id salvo.
     * 2. Chama a API.
     * 3. Salva os novos tickets (Upsert).
     */
    async syncTickets() {
        console.log('--- Iniciando Sincronização de Lista ---');

        // 1. Buscar o último event_id no banco
        // Ordenamos decrescente pelo event_id e pegamos o primeiro
        const lastTicket = await Ticket.findOne().sort({ event_id: -1 });

        // Regra de Negócio: Se não tiver nada, usa o padrão 28595223
        let currentEventId = lastTicket ? lastTicket.event_id : '28595223';

        console.log(`Usando event_id_last: ${currentEventId}`);

        // 2. Chamar o Service
        const apiData = await ocdService.fetchTicketAssignments(currentEventId);

        if (!apiData || !apiData.ticket_assignments) {
            console.log('Nenhum dado retornado da API.');
            return { processed: 0 };
        }

        const tickets = apiData.ticket_assignments;
        console.log(`${tickets.length} tickets encontrados. Salvando...`);

        // 3. Salvar no Banco (Iterar e Upsert)
        let processedCount = 0;

        // Usamos for...of para lidar com async/await corretamente
        for (const ticketData of tickets) {
            try {
                // Mapeia o JSON da API para o nosso Schema
                // Nota: O Schema deve estar preparado para receber campos extras ou fazemos o de-para aqui
                const payload = {
                    event_id: ticketData.event_id,
                    event_name: ticketData.event_name,
                    activity_number: ticketData.activity_number,
                    activity_severity_name: ticketData.activity_severity_name,
                    queue_name: ticketData.queue_name,
                    user_name: ticketData.user_name,
                    user_flu_name: ticketData.user_flu_name,
                    user_first_name: ticketData.user_first_name, // Garantindo campos extras do JSON
                    user_last_name: ticketData.user_last_name,
                    customer_fl: ticketData.customer_fl,
                    customer_name: ticketData.customer_name,
                    entered_time: ticketData.entered_time,
                    activity_type_name: ticketData.activity_type_name,
                    activity_skill_name: ticketData.activity_skill_name,
                    // detail: {} // Ainda vazio, será preenchido no próximo passo
                };

                await Ticket.upsertTicket(payload);
                processedCount++;
            } catch (err) {
                console.error(`Erro ao salvar ticket ${ticketData.activity_number}:`, err.message);
            }
        }

        console.log(`Sincronização finalizada. Processados: ${processedCount}`);

        // Retorna o novo event_id_last fornecido pela API para referência futura, se necessário
        return {
            processed: processedCount,
            api_last_event_id: apiData.event_id_last
        };
    }
}

module.exports = new TicketUsecase();