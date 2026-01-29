const Ticket = require('../models/Ticket');
const ticketUsecase = require('../usecase/TicketUsecase');

class APIController {

    _dateToTimestamp(dateStr, endOfDay = false) {
        if (!dateStr) return null;
        // Tratamento robusto para DD/MM/YYYY ou YYYY-MM-DD
        const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');

        let day, month, year;
        if (parts[0].length === 4) { // YYYY-MM-DD
            [year, month, day] = parts;
        } else { // DD/MM/YYYY
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

    async getDashboardData(req, res) {
        try {
            const { startDate, endDate } = req.query;

            if (!startDate || !endDate) {
                return res.status(400).json({ error: 'Parâmetros startDate e endDate são obrigatórios.' });
            }

            const startTs = this._dateToTimestamp(startDate);
            const endTs = this._dateToTimestamp(endDate, true);

            console.log(`Buscando (FULL LIST) entre ${startDate} e ${endDate}`);

            // --- Lógica de Sync (Mantida) ---
            const lastTicket = await Ticket.findOne().sort({ entered_time: -1 });
            let dbMaxTs = lastTicket && lastTicket.entered_time ? parseInt(lastTicket.entered_time) : 0;

            if (parseInt(endTs) > dbMaxTs) {
                console.log(`Sync necessário...`);
                await ticketUsecase.syncTickets();
            }

            // --- Pipeline Unificado ---
            const aggregationPipeline = [
                {
                    $match: {
                        entered_time: { $gte: startTs, $lte: endTs }
                    }
                },
                {
                    $facet: {
                        // 1. Estatísticas Globais
                        "summary": [
                            {
                                $group: {
                                    _id: null,
                                    totalTickets: { $sum: 1 },
                                    totalBillable: {
                                        $sum: { $cond: [{ $eq: ["$billable", "1"] }, 1, 0] }
                                    },
                                    totalCreditRisk: {
                                        $sum: { $cond: [{ $eq: ["$credit_risk", "1"] }, 1, 0] }
                                    },
                                    totalCoDelivery: {
                                        $sum: { $cond: [{ $eq: ["$co_delivery", "1"] }, 1, 0] }
                                    },
                                    totalNRSSO: {
                                        $sum: {
                                            $cond: [{ $regexMatch: { input: "$customer_name", regex: /NRSSO/i } }, 1, 0]
                                        }
                                    }
                                }
                            }
                        ],
                        // 2. Agrupamento por Tipo
                        "byType": [
                            {
                                $group: {
                                    _id: "$activity_type_name",
                                    count: { $sum: 1 }
                                }
                            }
                        ],
                        // 3. A Lista COMPLETA (Sem skip/limit)
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

                                    // Flags solicitadas (Retorna "1" ou "0")
                                    billable: 1,
                                    credit_risk: 1,
                                    co_delivery: 1,

                                    // Cálculo de NRSSO linha a linha
                                    is_nrsso: {
                                        $cond: [
                                            { $regexMatch: { input: "$customer_name", regex: /NRSSO/i } },
                                            "1",
                                            "0"
                                        ]
                                    },

                                    // Conversão de Data para GMT legível
                                    entered_time_gmt: {
                                        $dateToString: {
                                            format: "%d/%m/%Y %H:%M:%S", // Formato Brasileiro com hora
                                            date: {
                                                $toDate: {
                                                    $multiply: [{ $toDouble: "$entered_time" }, 1000]
                                                }
                                            },
                                            timezone: "GMT" // Força GMT
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
                list: data.tickets // Retorna todos os itens
            });

        } catch (error) {
            console.error('Erro no Dashboard Data:', error);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    }
}

module.exports = new APIController();