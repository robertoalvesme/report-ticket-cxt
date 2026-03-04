const Ticket = require('../models/Ticket');
const ocdService = require('../services/OCDService');

class TicketUsecase {

    /**
     * Sincroniza a lista de tickets vinda do OCD.
     * Agora utiliza o activity_number como chave para evitar duplicados.
     */
    async syncTickets() {
        console.log('--- Iniciando Sincronização de Lista OCD ---');

        const lastTicket = await Ticket.findOne().sort({ event_id: -1 });
        let currentEventId = lastTicket ? lastTicket.event_id : '28595223';

        console.log(`Usando event_id_last: ${currentEventId}`);

        const apiData = await ocdService.fetchTicketAssignments(currentEventId);

        if (!apiData || !apiData.ticket_assignments) {
            console.log('Nenhum dado retornado da API.');
            return { processed: 0 };
        }

        const tickets = apiData.ticket_assignments;
        console.log(`${tickets.length} tickets encontrados. Processando...`);

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
                };

                /**
                 * IMPORTANTE: O upsertTicket agora busca por activity_number no Model.
                 * Isso garante que o SR 1-23360911182 seja único, apenas atualizando o evento.
                 */
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
     * Obtém o próximo ticket que precisa ser atualizado (Audit Trail e Detalhes).
     * Critério: Flag 'updated' é false ou não existe.
     */
    async getNextPendingTicket() {
        return await Ticket.findOne({
            $or: [
                { updated: { $ne: true } },
                { updated: false }
            ]
        }).sort({ entered_time: 1 });
    }

    /**
     * Atualiza os detalhes de auditoria, resoluções e horas de um chamado.
     * @param {string} activityNumber - O número do chamado (SR#)
     * @param {object} data - Dados vindos do ReportService
     */
    async updateTicketDetails(activityNumber, data) {
        try {
            const updatePayload = {
                updated: true, // Tira da fila de processamento
                last_updated_at: new Date(),
                sync_error: null
            };

            // Mapeamento dos campos do ReportService para o Schema
            if (data.billable !== undefined) updatePayload.billable = data.billable;
            if (data.co_delivery !== undefined) updatePayload.co_delivery = data.co_delivery;
            if (data.creditRisk !== undefined) updatePayload.credit_risk = data.creditRisk;

            // Novos campos de resolução e auditoria
            if (data.source !== undefined) updatePayload.source = data.source;
            if (data.resolutionNote !== undefined) updatePayload.resolutionNote = data.resolutionNote;
            if (data.serviceAction !== undefined) updatePayload.serviceAction = data.serviceAction;
            if (data.resolutionAction !== undefined) updatePayload.resolutionAction = data.resolutionAction;
            if (data.resolutionDetail !== undefined) updatePayload.resolutionDetail = data.resolutionDetail;
            if (data.srOwner !== undefined) updatePayload.srOwner = data.srOwner;
            if (data.srAgeDays !== undefined) updatePayload.srAgeDays = data.srAgeDays;

            // Campo de horas somadas por handlers permitidos
            if (data.hoursBooked !== undefined) updatePayload.hoursBooked = data.hoursBooked;
            if (data.region !== undefined) updatePayload.region = data.region;

            const updatedTicket = await Ticket.findOneAndUpdate(
                { activity_number: activityNumber },
                { $set: updatePayload },
                { new: true }
            );

            return updatedTicket;
        } catch (error) {
            console.error(`Erro ao atualizar detalhes do ticket ${activityNumber}:`, error.message);
            throw error;
        }
    }

    /**
     * Marca o ticket como processado mesmo em caso de falha no crawler,
     * para evitar que um erro de 404 trave a fila infinitamente.
     */
    async markAsFailed(activityNumber, errorMessage) {
        try {
            console.log(`[Usecase] Marcando ticket ${activityNumber} como falha para não travar a fila.`);

            await Ticket.findOneAndUpdate(
                { activity_number: activityNumber },
                {
                    $set: {
                        updated: true,
                        sync_error: errorMessage,
                        last_updated_at: new Date()
                    }
                }
            );
        } catch (err) {
            console.error('Erro crítico ao marcar falha:', err);
        }
    }

}

module.exports = new TicketUsecase();