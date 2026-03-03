const Ticket = require('../models/Ticket');
const ocdService = require('../services/OCDService');

class TicketUsecase {

    async syncTickets() {
        console.log('--- Iniciando Sincronização de Lista ---');
        const lastTicket = await Ticket.findOne().sort({ event_id: -1 });
        let currentEventId = lastTicket ? lastTicket.event_id : '28595223';

        const apiData = await ocdService.fetchTicketAssignments(currentEventId);
        if (!apiData || !apiData.ticket_assignments) return { processed: 0 };

        let processedCount = 0;
        for (const ticketData of apiData.ticket_assignments) {
            try {
                const payload = {
                    event_id: ticketData.event_id,
                    event_name: ticketData.event_name,
                    activity_number: ticketData.activity_number,
                    activity_severity_name: ticketData.activity_severity_name,
                    queue_name: ticketData.queue_name,
                    user_flu_name: ticketData.user_flu_name,
                    customer_name: ticketData.customer_name,
                    entered_time: ticketData.entered_time,
                    activity_type_name: ticketData.activity_type_name,
                    billable: ticketData.billable === '1',
                    credit_risk: ticketData.credit_risk === '1',
                    co_delivery: ticketData.co_delivery === '1',
                    nrsso: ticketData.customer_fl === '0000000010'
                };

                await Ticket.upsertTicket(payload);
                processedCount++;
            } catch (err) {
                console.error(`Erro ao salvar ticket ${ticketData.activity_number}:`, err.message);
            }
        }
        return { processed: processedCount, api_last_event_id: apiData.event_id_last };
    }

    async getNextPendingTicket() {
        return await Ticket.findOne({
            $or: [{ updated: { $ne: true } }, { updated: false }]
        }).sort({ entered_time: 1 });
    }

    async updateTicketDetails(activityNumber, data) {
        try {
            const updatePayload = {
                updated: true,
                last_updated_at: new Date(),
                sync_error: null
            };

            if (data.billable !== undefined) updatePayload.billable = data.billable;
            if (data.co_delivery !== undefined) updatePayload.co_delivery = data.co_delivery;
            if (data.creditRisk !== undefined) updatePayload.credit_risk = data.creditRisk;
            if (data.source !== undefined) updatePayload.source = data.source;
            if (data.resolutionNote !== undefined) updatePayload.resolutionNote = data.resolutionNote;

            // Novos campos de detalhe e horas
            if (data.serviceAction !== undefined) updatePayload.serviceAction = data.serviceAction;
            if (data.resolutionAction !== undefined) updatePayload.resolutionAction = data.resolutionAction;
            if (data.resolutionDetail !== undefined) updatePayload.resolutionDetail = data.resolutionDetail;
            if (data.srOwner !== undefined) updatePayload.srOwner = data.srOwner;
            if (data.srAgeDays !== undefined) updatePayload.srAgeDays = data.srAgeDays;
            if (data.hoursBooked !== undefined) updatePayload.hoursBooked = data.hoursBooked;

            return await Ticket.findOneAndUpdate(
                { activity_number: activityNumber },
                { $set: updatePayload },
                { new: true }
            );
        } catch (error) {
            throw error;
        }
    }

    async markAsFailed(activityNumber, errorMessage) {
        try {
            await Ticket.findOneAndUpdate(
                { activity_number: activityNumber },
                { $set: { updated: true, sync_error: errorMessage, last_updated_at: new Date() } }
            );
        } catch (err) {
            console.error('Erro ao marcar falha:', err);
        }
    }
}

module.exports = new TicketUsecase();