const Ticket = require('../models/Ticket');
const ticketUsecase = require('../usecase/TicketUsecase');
const reportService = require('../services/ReportService');

class APIController {

    /**
     * Auxiliar para converter strings de data em timestamp Unix (segundos).
     */
    _dateToTimestamp(dateStr, endOfDay = false) {
        if (!dateStr) return null;
        const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
        let day, month, year;
        if (parts[0].length === 4) {
            [year, month, day] = parts;
        } else {
            [day, month, year] = parts;
        }
        const date = new Date(year, month - 1, day);
        if (endOfDay) {
            date.setHours(23, 59, 59, 999);
        } else {
            date.setHours(0, 0, 0, 0);
        }
        return Math.floor(date.getTime() / 1000).toString();
    }

    /**
     * Endpoint principal do Dashboard.
     * Retorna o resumo, tipos e a lista detalhada de tickets.
     */
    async getDashboardData(req, res) {
        try {
            const { startDate, endDate } = req.query;

            if (!startDate || !endDate) {
                return res.status(400).json({ error: 'Parâmetros startDate e endDate são obrigatórios.' });
            }

            const startTs = this._dateToTimestamp(startDate);
            const endTs = this._dateToTimestamp(endDate, true);

            // Verifica se precisamos sincronizar novos tickets do OCD antes de listar
            const lastTicket = await Ticket.findOne().sort({ entered_time: -1 });
            let dbMaxTs = lastTicket && lastTicket.entered_time ? parseInt(lastTicket.entered_time) : 0;

            if (parseInt(endTs) > dbMaxTs) {
                await ticketUsecase.syncTickets();
            }

            const aggregationPipeline = [
                {
                    $match: {
                        entered_time: { $gte: startTs, $lte: endTs }
                    }
                },
                {
                    $facet: {
                        "summary": [
                            {
                                $group: {
                                    _id: null,
                                    totalTickets: { $sum: 1 },
                                    totalBillable: { $sum: { $cond: [{ $eq: ["$billable", true] }, 1, 0] } },
                                    totalCreditRisk: { $sum: { $cond: [{ $eq: ["$credit_risk", true] }, 1, 0] } },
                                    totalCoDelivery: { $sum: { $cond: [{ $eq: ["$co_delivery", true] }, 1, 0] } },
                                    totalNRSSO: { $sum: { $cond: [{ $eq: ["$nrsso", true] }, 1, 0] } }
                                }
                            }
                        ],
                        "byType": [
                            { $group: { _id: "$activity_type_name", count: { $sum: 1 } } }
                        ],
                        "tickets": [
                            { $sort: { entered_time: -1 } },
                            {
                                $project: {
                                    _id: 0,
                                    event_id: 1,
                                    activity_number: 1,
                                    customer_name: 1,
                                    user_flu_name: 1,
                                    activity_skill_name: 1,
                                    activity_type_name: 1,
                                    billable: 1,
                                    credit_risk: 1,
                                    co_delivery: 1,
                                    nrsso: 1,
                                    source: 1,
                                    resolutionNote: 1,
                                    updated: 1,
                                    // --- CAMPOS DO CRAWLER EXPOSTOS ---
                                    region: 1,
                                    hoursBooked: 1,
                                    srAgeDays: 1,
                                    srOwner: 1,
                                    serviceAction: 1,
                                    serviceActionFirst: 1,
                                    resolutionAction: 1,
                                    resolutionDetail: 1,
                                    // ----------------------------------
                                    entered_time_gmt: {
                                        $dateToString: {
                                            format: "%d/%m/%Y %H:%M:%S",
                                            date: {
                                                $toDate: { $multiply: [{ $toDouble: "$entered_time" }, 1000] }
                                            },
                                            timezone: "GMT"
                                        }
                                    }
                                }
                            }
                        ]
                    }
                }
            ];

            const result = await Ticket.aggregate(aggregationPipeline);
            const data = result[0];

            return res.json({
                period: { startDate, endDate },
                summary: data.summary[0] || { totalTickets: 0, totalBillable: 0, totalCreditRisk: 0, totalCoDelivery: 0, totalNRSSO: 0 },
                types: data.byType.map(t => ({ type: t._id || 'Outros', count: t.count })),
                list: data.tickets
            });

        } catch (error) {
            console.error('Erro no Dashboard Data:', error);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    }

    /**
     * Retorna o próximo ticket que o Worker deve processar.
     */
    async getPendingTicket(req, res) {
        try {
            const ticket = await ticketUsecase.getNextPendingTicket();
            if (!ticket) return res.status(404).json({ message: 'Nenhum ticket pendente.' });

            return res.json({
                activity_number: ticket.activity_number,
                event_id: ticket.event_id,
                entered_time: ticket.entered_time
            });
        } catch (error) {
            return res.status(500).json({ error: 'Erro interno ao buscar pendente.' });
        }
    }

    /**
     * Aciona manualmente o crawler para um ticket específico.
     */
    async syncTicketDetails(req, res) {
        const { activityNumber } = req.params;
        if (!activityNumber) return res.status(400).json({ error: 'Activity Number é obrigatório.' });

        console.log(`[API] Iniciando sync manual para: ${activityNumber}`);

        try {
            // O ReportService agora busca o site_id internamente no banco
            const reportData = await reportService.getTicketFullDetails(activityNumber);

            // Atualiza o ticket com os dados do crawler (incluindo Region e Hours)
            const updatedTicket = await ticketUsecase.updateTicketDetails(activityNumber, reportData);

            return res.json({
                success: true,
                message: `Ticket ${activityNumber} atualizado com sucesso.`,
                data: updatedTicket
            });

        } catch (error) {
            console.error(`[API] Erro no Crawler para ${activityNumber}: ${error.message}`);

            // Marca como falha para não travar a fila do worker
            await ticketUsecase.markAsFailed(activityNumber, error.message);

            return res.json({
                success: false,
                message: `Falha ao obter dados: ${error.message}`
            });
        }
    }
}

module.exports = new APIController();