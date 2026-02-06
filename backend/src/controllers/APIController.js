const Ticket = require('../models/Ticket');
const ticketUsecase = require('../usecase/TicketUsecase');
const reportService = require('../services/ReportService'); // [Importante] Importar o serviço

class APIController {

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

    // --- Endpoint do Dashboard (Já existente) ---
    async getDashboardData(req, res) {
        try {
            const { startDate, endDate } = req.query;

            if (!startDate || !endDate) {
                return res.status(400).json({ error: 'Parâmetros startDate e endDate são obrigatórios.' });
            }

            const startTs = this._dateToTimestamp(startDate);
            const endTs = this._dateToTimestamp(endDate, true);

            console.log(`Buscando (FULL LIST) entre ${startDate} e ${endDate}`);

            const lastTicket = await Ticket.findOne().sort({ entered_time: -1 });
            let dbMaxTs = lastTicket && lastTicket.entered_time ? parseInt(lastTicket.entered_time) : 0;

            if (parseInt(endTs) > dbMaxTs) {
                console.log(`Sync necessário...`);
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
                                    totalBillable: {
                                        $sum: { $cond: [{ $eq: ["$billable", true] }, 1, 0] }
                                    },
                                    totalCreditRisk: {
                                        $sum: { $cond: [{ $eq: ["$credit_risk", true] }, 1, 0] }
                                    },
                                    totalCoDelivery: {
                                        $sum: { $cond: [{ $eq: ["$co_delivery", true] }, 1, 0] }
                                    },
                                    totalNRSSO: {
                                        $sum: { $cond: [{ $eq: ["$nrsso", true] }, 1, 0] }
                                    }
                                }
                            }
                        ],
                        "byType": [
                            {
                                $group: {
                                    _id: "$activity_type_name",
                                    count: { $sum: 1 }
                                }
                            }
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
                                    activity_status: "$detail.activity_status_name",
                                    activity_skill_name: 1,
                                    activity_type_name: 1,
                                    billable: 1,
                                    credit_risk: 1,
                                    co_delivery: 1,
                                    nrsso: 1,
                                    // Novos campos retornados
                                    source: 1,
                                    resolutionNote: 1,
                                    updated: 1,
                                    entered_time_gmt: {
                                        $dateToString: {
                                            format: "%d/%m/%Y %H:%M:%S",
                                            date: {
                                                $toDate: {
                                                    $multiply: [{ $toDouble: "$entered_time" }, 1000]
                                                }
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
                summary: data.summary[0] || {
                    totalTickets: 0, totalBillable: 0, totalCreditRisk: 0, totalCoDelivery: 0, totalNRSSO: 0
                },
                types: data.byType.map(t => ({ type: t._id || 'Outros', count: t.count })),
                list: data.tickets
            });

        } catch (error) {
            console.error('Erro no Dashboard Data:', error);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    }

    // --- NOVO MÉTODO 1: Obter Próximo Ticket Pendente ---
    async getPendingTicket(req, res) {
        try {
            const ticket = await ticketUsecase.getNextPendingTicket();

            if (!ticket) {
                return res.status(404).json({ message: 'Nenhum ticket pendente de atualização.' });
            }

            return res.json({
                activity_number: ticket.activity_number,
                event_id: ticket.event_id,
                entered_time: ticket.entered_time
            });
        } catch (error) {
            console.error('Erro ao buscar ticket pendente:', error);
            return res.status(500).json({ error: 'Erro interno ao buscar ticket pendente.' });
        }
    }

    // --- NOVO MÉTODO 2: Sincronizar Detalhes (Crawler -> Usecase -> DB) ---
    async syncTicketDetails(req, res) {
        try {
            const { activityNumber } = req.params;

            if (!activityNumber) {
                return res.status(400).json({ error: 'Activity Number é obrigatório.' });
            }

            console.log(`[API] Iniciando sync manual para: ${activityNumber}`);

            // 1. Crawler: Busca dados do ReportService (HTMLs)
            const reportData = await reportService.getTicketFullDetails(activityNumber);

            // 2. Mapping: Ajusta nomes se necessário para o Usecase
            // ReportService retorna { co_delivery: bool }, Usecase espera { codelivery: bool }
            const payload = {
                ...reportData,
                codelivery: reportData.co_delivery
            };

            // 3. Database: Atualiza via Usecase
            const updatedTicket = await ticketUsecase.updateTicketDetails(activityNumber, payload);

            return res.json({
                success: true,
                message: `Ticket ${activityNumber} atualizado com sucesso.`,
                data: updatedTicket
            });

        } catch (error) {
            console.error(`Erro ao sincronizar detalhes do ticket ${req.params.activityNumber}:`, error.message);
            // Retorna erro 500 com a mensagem para facilitar debug no cliente
            return res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new APIController();