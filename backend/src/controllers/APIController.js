const Ticket = require('../models/Ticket');
const ticketUsecase = require('../usecase/TicketUsecase');

class APIController {

    /**
     * Converte data DD/MM/YYYY para Unix Timestamp (String)
     */
    // backend/src/controllers/APIController.js
    _dateToTimestamp(dateStr, endOfDay = false) {
        if (!dateStr) return null;
        const parts = dateStr.trim().split('-');
        if (parts.length !== 3) return null;

        const [yearStr, monthStr, dayStr] = parts;
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10) - 1;
        const day = parseInt(dayStr, 10);

        if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;

        const ms = Date.UTC(
            year,
            month,
            day,
            endOfDay ? 23 : 0,
            endOfDay ? 59 : 0,
            endOfDay ? 59 : 0,
            endOfDay ? 999 : 0
        );

        return Math.floor(ms / 1000).toString();
    }

    async getDashboardData(req, res) {
        try {
            const { startDate, endDate } = req.query;

            if (!startDate || !endDate) {
                return res.status(400).json({ error: 'Parâmetros startDate e endDate (DD/MM/YYYY) são obrigatórios.' });
            }

            // 1. Converter datas recebidas para Timestamp
            const startTs = this._dateToTimestamp(startDate);
            const endTs = this._dateToTimestamp(endDate, true);

            console.log(`Buscando dados entre ${startDate} (${startTs}) e ${endDate} (${endTs})`);

            // 2. Lógica de Atualização Automática (Sync)
            // Verifica qual o ticket mais recente no banco
            const lastTicket = await Ticket.findOne().sort({ entered_time: -1 });

            let dbMaxTs = 0;
            if (lastTicket && lastTicket.entered_time) {
                dbMaxTs = parseInt(lastTicket.entered_time);
            }

            // Se a data fim solicitada for maior que o que temos no banco, tenta atualizar
            if (parseInt(endTs) > dbMaxTs) {
                console.log(`Data solicitada (${endTs}) maior que banco (${dbMaxTs}). Iniciando sincronização...`);
                // Aciona o usecase (que já pega o last_event_id do banco internamente)
                await ticketUsecase.syncTickets();
            }

            // 3. Montar a Agregação (Summarization)
            const aggregationPipeline = [
                {
                    // Filtra pelo período
                    $match: {
                        entered_time: { $gte: startTs, $lte: endTs }
                    }
                },
                {
                    // Facet permite rodar múltiplos cálculos (buckets) na mesma query
                    $facet: {
                        // Totais Gerais
                        "stats": [
                            {
                                $group: {
                                    _id: null,
                                    totalTickets: { $sum: 1 },
                                    // Soma se o campo for "1" (conforme padrão da Avaya)
                                    totalBillable: {
                                        $sum: { $cond: [{ $eq: ["$billable", "1"] }, 1, 0] }
                                    },
                                    totalCreditRisk: {
                                        $sum: { $cond: [{ $eq: ["$credit_risk", "1"] }, 1, 0] }
                                    },
                                    totalCoDelivery: {
                                        $sum: { $cond: [{ $eq: ["$co_delivery", "1"] }, 1, 0] }
                                    },
                                    // Regex para achar NRSSO no nome do cliente
                                    totalNRSSO: {
                                        $sum: {
                                            $cond: [
                                                { $regexMatch: { input: "$customer_name", regex: /NRSSO/i } },
                                                1,
                                                0
                                            ]
                                        }
                                    }
                                }
                            }
                        ],
                        // Agrupamento por Tipo (Type)
                        "byType": [
                            {
                                $group: {
                                    _id: "$activity_type_name",
                                    count: { $sum: 1 }
                                }
                            }
                        ]
                    }
                }
            ];

            const result = await Ticket.aggregate(aggregationPipeline);

            // Formatar a saída para o Frontend
            const stats = result[0].stats[0] || {
                totalTickets: 0,
                totalBillable: 0,
                totalCreditRisk: 0,
                totalCoDelivery: 0,
                totalNRSSO: 0
            };

            const byType = result[0].byType.map(t => ({
                type: t._id || 'Desconhecido',
                count: t.count
            }));

            return res.json({
                period: { startDate, endDate },
                summary: stats,
                types: byType
            });

        } catch (error) {
            console.error('Erro no Dashboard Data:', error);
            return res.status(500).json({ error: 'Erro interno ao buscar dados.' });
        }
    }
}

module.exports = new APIController();