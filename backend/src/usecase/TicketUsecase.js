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

    /**
     * Obtém o próximo ticket que precisa ser atualizado (Audit Trail).
     * Critério: Flag 'updated' é false ou não existe.
     * Ordem: Mais antigo primeiro (entered_time ascendente).
     */
    async getNextPendingTicket() {
        try {
            return await Ticket.findOne({
                $or: [
                    { updated: false },
                    { updated: { $exists: false } }
                ]
            })
                .sort({ entered_time: 1 }) // 1 para Ascendente (Mais antigo -> Mais novo)
                .limit(1);
        } catch (error) {
            console.error('Erro ao buscar próximo ticket pendente:', error.message);
            throw error;
        }
    }

    /**
     * Atualiza os detalhes de auditoria de um chamado específico.
     * @param {string} activityNumber - O número do chamado (SR#)
     * @param {object} data - Objeto contendo { billable, codelivery, creditRisk, source, resolutionNote }
     */
    async updateTicketDetails(activityNumber, data) {
        try {
            const updatePayload = {
                updated: true, // Marca como processado para sair da fila
                last_updated_at: new Date()
            };

            // Mapeia os parâmetros recebidos para o Schema do Banco
            if (data.billable !== undefined) updatePayload.billable = data.billable;
            if (data.codelivery !== undefined) updatePayload.co_delivery = data.codelivery; // Nota: DB usa co_delivery
            if (data.creditRisk !== undefined) updatePayload.credit_risk = data.creditRisk; // Nota: DB usa credit_risk
            if (data.source !== undefined) updatePayload.source = data.source;
            if (data.resolutionNote !== undefined) updatePayload.resolutionNote = data.resolutionNote;

            const updatedTicket = await Ticket.findOneAndUpdate(
                { activity_number: activityNumber },
                { $set: updatePayload },
                { new: true } // Retorna o objeto atualizado
            );

            if (!updatedTicket) {
                throw new Error(`Ticket ${activityNumber} não encontrado.`);
            }

            console.log(`Ticket ${activityNumber} atualizado com sucesso via Audit.`);
            return updatedTicket;

        } catch (error) {
            console.error(`Erro ao atualizar detalhes do ticket ${activityNumber}:`, error.message);
            throw error;
        }
    }
}

module.exports = new TicketUsecase();