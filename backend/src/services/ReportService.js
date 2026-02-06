const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

class ReportService {
    constructor() {
        this.auditUrl = 'https://report.avaya.com/siebelreports/audittrail.aspx';
        this.detailsUrl = 'https://report.avaya.com/siebelreports/casedetails.aspx';

        this.auth = {
            username: process.env.REPORT_USER,
            password: process.env.REPORT_PASS
        };

        this.httpsAgent = new https.Agent({ rejectUnauthorized: false });
    }

    async getTicketFullDetails(ticketNumber) {
        try {
            console.log(`[ReportService] Buscando dados para: ${ticketNumber}`);

            const [auditHtml, detailsHtml] = await Promise.all([
                this._fetchHtml(this.auditUrl, { sr_num: ticketNumber }),
                this._fetchHtml(this.detailsUrl, { case_id: ticketNumber })
            ]);

            const detailsData = this._parseCaseDetails(detailsHtml);
            const auditData = this._parseAuditTrail(auditHtml);

            return {
                ...detailsData,
                ...auditData
            };

        } catch (error) {
            console.error(`Erro ao processar ticket ${ticketNumber}:`, error.message);
            throw error;
        }
    }

    async _fetchHtml(baseUrl, params) {
        try {
            const response = await axios.get(baseUrl, {
                params,
                auth: this.auth,
                httpsAgent: this.httpsAgent,
                responseType: 'text'
            });
            return response.data;
        } catch (error) {
            throw new Error(`Falha no request para ${baseUrl}: ${error.message}`);
        }
    }

    // --- CASE DETAILS PARSING ---

    _parseCaseDetails(html) {
        const $ = cheerio.load(html);

        // Mapeamento dos campos baseado no HTML fornecido
        const creditRiskVal = this._extractDetailField($, 'Credit Risk');

        return {
            // Assume "Y" como true, qualquer outra coisa como false
            creditRisk: creditRiskVal === 'Y',
            source: this._extractDetailField($, 'Source'),
            resolutionNote: this._extractDetailField($, 'SR Resolution Note')
        };
    }

    /**
     * Busca EXATA pelo texto dentro dos SPANs da tabela.
     * Isso evita confundir "Source" com "System Source ID".
     */
    _extractDetailField($, labelText) {
        let foundValue = null;

        // Itera sobre todos os spans para achar o Label EXATO
        $('span').each((i, el) => {
            const text = $(el).text().trim();

            // Verifica se o texto é exatamente o label procurado (ignorando : se houver)
            if (text === labelText || text === labelText + ':') {
                // Estrutura do HTML:
                // TD > SPAN(Label) ... navega para ... Próximo TD > SPAN(Valor) ou Texto
                const parentTd = $(el).closest('td');
                const nextTd = parentTd.next('td');

                if (nextTd.length) {
                    foundValue = nextTd.text().trim();
                    return false; // Break loop
                }
            }
        });

        return foundValue;
    }

    // --- AUDIT TRAIL PARSING ---

    _parseAuditTrail(html) {
        const $ = cheerio.load(html);
        const rows = this._extractAuditRows($);

        // Ordena Cronologicamente (Antigo -> Novo)
        const sortedRows = rows.sort((a, b) => a.timestamp - b.timestamp);

        // 1. Encontrar o Timestamp da atribuição ao CXT_GLOBAL
        const assignmentEvent = sortedRows.find(row =>
            row.field === 'Owner' && row.newValue === 'CXT_GLOBAL'
        );

        let relevantEvents;

        if (assignmentEvent) {
            // Pega tudo que aconteceu até o exato momento da atribuição (inclusive)
            const cutoffTime = assignmentEvent.timestamp;
            relevantEvents = sortedRows.filter(row => row.timestamp <= cutoffTime);
        } else {
            // Se nunca foi CXT, olha o histórico todo
            relevantEvents = sortedRows;
        }

        return this._calculateFlags(relevantEvents);
    }

    _extractAuditRows($) {
        const rows = [];
        $('table tr').each((i, elem) => {
            const cols = $(elem).find('td');
            if (cols.length >= 5) {
                const dateStr = $(cols[0]).text().trim();
                const fieldName = $(cols[2]).text().trim();
                const newVal = $(cols[4]).text().trim();

                // Ignora cabeçalhos
                if (dateStr === 'CREATED' || dateStr === 'Type') return;

                const timestamp = this._parseDateUS(dateStr);

                if (timestamp > 0) {
                    rows.push({
                        dateRaw: dateStr,
                        timestamp: timestamp,
                        field: fieldName,
                        newValue: newVal
                    });
                }
            }
        });
        return rows;
    }

    _parseDateUS(dateStr) {
        try {
            // Formato esperado: "2/6/2026 7:05:50 AM"
            const cleanStr = dateStr.replace(/\s+/g, ' ').trim();
            const [datePart, timePart, meridian] = cleanStr.split(' ');

            if (!datePart || !timePart) return 0;

            const [month, day, year] = datePart.split('/');
            let [hours, minutes, seconds] = timePart.split(':');

            let h = parseInt(hours, 10);
            const m = parseInt(minutes, 10);
            const s = parseInt(seconds, 10);

            if (meridian === 'PM' && h !== 12) h += 12;
            if (meridian === 'AM' && h === 12) h = 0;

            return new Date(year, month - 1, day, h, m, s).getTime();
        } catch (e) {
            return 0;
        }
    }

    _calculateFlags(events) {
        let billable = false;
        let co_delivery = false;

        events.forEach(event => {
            if (event.field === 'BILLABLE_FLG') {
                billable = event.newValue === 'Y';
            }
            if (event.field === 'X_AV_SR_CODELIVERY_FLG') {
                co_delivery = event.newValue === 'Y';
            }
        });

        return {
            billable,
            co_delivery
        };
    }
}

module.exports = new ReportService();