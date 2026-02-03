const Ticket = require('../models/Ticket');
const ocdService = require('../services/OCDService');

class TicketUsecase {

    async syncTickets() {
        console.log('--- Iniciando Sincronização de Lista ---');

        const lastTicket = await Ticket.findOne().sort({ event_id: -1 });
        let currentEventId = lastTicket ? lastTicket.event_id : '28595223';

        console.log(`Usando event_id_last: ${currentEventId}`);

        const apiData = await ocdService.fetchTicketAssignments(currentEventId);

        if (!apiData || !apiData.ticket_assignments) {
            console.log('Nenhum dado retornado da API.');
            return { processed: 0 };
        }

        const tickets = apiData.ticket_assignments;
        console.log(`${tickets.length} tickets encontrados. Salvando...`);

        let processedCount = 0;

        for (const ticketData of tickets) {
            try {
                // Lógica para definir se é NRSSO
                const isNrsso = ticketData.customer_fl === '0000000010';

                const payload = {
                    event_id: ticketData.event_id,
                    event_name: ticketData.event_name,
                    activity_number: ticketData.activity_number,
                    activity_severity_name: ticketData.activity_severity_name,
                    queue_name: ticketData.queue_name,
                    user_name: ticketData.user_name,
                    user_flu_name: ticketData.user_flu_name,
                    user_first_name: ticketData.user_first_name,
                    user_last_name: ticketData.user_last_name,
                    customer_fl: ticketData.customer_fl,
                    customer_name: ticketData.customer_name,
                    entered_time: ticketData.entered_time,
                    activity_type_name: ticketData.activity_type_name,
                    activity_skill_name: ticketData.activity_skill_name,

                    // --- CONVERSÃO PARA BOOLEANO ---
                    billable: ticketData.billable === '1',
                    credit_risk: ticketData.credit_risk === '1',
                    co_delivery: ticketData.co_delivery === '1',
                    nrsso: isNrsso
                    // -------------------------------
                };

                await Ticket.upsertTicket(payload);
                processedCount++;
            } catch (err) {
                console.error(`Erro ao salvar ticket ${ticketData.activity_number}:`, err.message);
            }
        }

        console.log(`Sincronização finalizada. Processados: ${processedCount}`);

        return {
            processed: processedCount,
            api_last_event_id: apiData.event_id_last
        };
    }
}

module.exports = new TicketUsecase();