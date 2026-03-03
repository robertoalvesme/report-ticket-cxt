const https = require('https');
const cheerio = require('cheerio');
const { NtlmClient } = require('axios-ntlm');

class ReportService {
    constructor() {
        // URLs ajustadas conforme o funcionamento do servidor
        this.auditUrl = 'https://report.avaya.com/siebelreports/audittrail.aspx';
        this.detailsUrl = 'https://report.avaya.com/siebelreports/casedetails.aspx';
        // Ajustado para /details/ conforme seu teste
        this.hoursUrl = 'https://report.avaya.com/details/hoursbreakdown.aspx';

        const fullUser = process.env.REPORT_USER || '';
        const pass = process.env.REPORT_PASS || '';

        // Processa Handlers permitidos (Case-Insensitive)
        const handlersRaw = process.env.ALLOWED_HANDLERS || '';
        this.allowedHandlers = handlersRaw.split(',').map(h => h.trim().toUpperCase());

        let domain = '';
        let username = fullUser;
        if (fullUser.includes('\\')) {
            const parts = fullUser.split('\\');
            domain = parts[0];
            username = parts[1];
        }

        this.credentials = { username, password: pass, domain };
        this.httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
    }

    async getTicketFullDetails(ticketNumber) {
        try {
            console.log(`[ReportService] Iniciando coleta de dados para: ${ticketNumber}`);

            // 1. Coleta Audit e Details (SiebelReports)
            const [auditHtml, detailsHtml] = await Promise.all([
                this._fetchHtml(this.auditUrl, { sr_num: ticketNumber }),
                this._fetchHtml(this.detailsUrl, { case_id: ticketNumber })
            ]);

            const detailsData = this._parseCaseDetails(detailsHtml);
            const auditData = this._parseAuditTrail(auditHtml);

            // 2. Coleta Hours Breakdown (Details) - Com Try/Catch para não quebrar o ticket se as horas falharem
            let hoursBooked = 0;
            try {
                const hoursHtml = await this._fetchHtml(this.hoursUrl, { caseid: ticketNumber });
                hoursBooked = this._parseHoursBreakdown(hoursHtml);
            } catch (hError) {
                console.warn(`[ReportService] Aviso: Falha ao obter horas para ${ticketNumber}: ${hError.message}`);
            }

            return {
                ...detailsData,
                ...auditData,
                hoursBooked
            };

        } catch (error) {
            console.error(`[ReportService] Erro crítico no ticket ${ticketNumber}:`, error.message);
            throw error;
        }
    }

    async _fetchHtml(baseUrl, params) {
        const urlObj = new URL(baseUrl);
        Object.keys(params).forEach(key => urlObj.searchParams.append(key, params[key]));

        const ntlmClient = NtlmClient({
            username: this.credentials.username,
            password: this.credentials.password,
            domain: this.credentials.domain,
        });

        const response = await ntlmClient.get(urlObj.toString(), {
            httpsAgent: this.httpsAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
                'Connection': 'keep-alive'
            }
        });

        return response.data;
    }

    _parseCaseDetails(html) {
        const $ = cheerio.load(html);
        return {
            creditRisk: this._extractDetailField($, 'Credit Risk') === 'Y',
            source: this._extractDetailField($, 'Source'),
            resolutionNote: this._extractDetailField($, 'SR Resolution Note'),
            serviceAction: this._extractDetailField($, 'Service Action'),
            resolutionAction: this._extractDetailField($, 'Resolution Action'),
            resolutionDetail: this._extractDetailField($, 'Resolution Detail'),
            srOwner: this._extractDetailField($, 'SR Owner'),
            srAgeDays: this._extractDetailField($, 'SR Age (days)')
        };
    }

    _parseHoursBreakdown(html) {
        const $ = cheerio.load(html);
        let total = 0;
        $('table.tableborder tr').each((i, el) => {
            if (i === 0) return;
            const cols = $(el).find('td');
            if (cols.length >= 4) {
                const login = $(cols[0]).text().trim().toUpperCase();
                const hours = parseFloat($(cols[3]).text().trim()) || 0;
                if (this.allowedHandlers.includes(login)) {
                    total += hours;
                }
            }
        });
        return total;
    }

    _extractDetailField($, labelText) {
        let foundValue = null;
        $('span').each((i, el) => {
            const text = $(el).text().trim();
            if (text === labelText || text === labelText + ':') {
                const nextTd = $(el).closest('td').next('td');
                if (nextTd.length) {
                    foundValue = nextTd.text().trim();
                    return false;
                }
            }
        });
        return foundValue;
    }

    _parseAuditTrail(html) {
        const $ = cheerio.load(html);
        const rows = this._extractAuditRows($);
        const sortedRows = rows.sort((a, b) => a.timestamp - b.timestamp);

        let assignmentEvent = sortedRows.find(row => row.field === 'Owner' && row.newValue === 'CXT_GLOBAL') ||
            sortedRows.find(row => row.field === 'Owner' && row.oldValue === 'CXT_GLOBAL') ||
            sortedRows.find(row => row.field === 'Owner' && row.newValue && !['CXT_GLOBAL', 'TANGO', 'Unassigned', ''].includes(row.newValue));

        let relevantEvents = assignmentEvent ? sortedRows.filter(row => row.timestamp <= assignmentEvent.timestamp) : sortedRows;
        return this._calculateFlags(relevantEvents);
    }

    _extractAuditRows($) {
        const rows = [];
        $('table tr').each((i, elem) => {
            if (i === 0) return;
            const cols = $(elem).find('td');
            if (cols.length > 7) {
                const timestamp = this._parseDateUS($(cols[7]).text().trim());
                if (timestamp > 0) {
                    rows.push({
                        timestamp,
                        field: $(cols[2]).text().trim(),
                        oldValue: $(cols[3]).text().trim(),
                        newValue: $(cols[4]).text().trim()
                    });
                }
            }
        });
        return rows;
    }

    _parseDateUS(dateStr) {
        try {
            const cleanStr = dateStr.replace(/\s+/g, ' ').trim();
            const [datePart, timePart, meridian] = cleanStr.split(' ');
            const [month, day, year] = datePart.split('/');
            let [h, m, s] = timePart.split(':').map(n => parseInt(n, 10));
            if (meridian === 'PM' && h !== 12) h += 12;
            if (meridian === 'AM' && h === 12) h = 0;
            return new Date(year, month - 1, day, h, m, s).getTime();
        } catch (e) { return 0; }
    }

    _calculateFlags(events) {
        let billable = false, co_delivery = false;
        let foundB = false, foundC = false;
        events.forEach(event => {
            if (event.field === 'BILLABLE_FLG' && !foundB) { billable = event.newValue === 'Y'; foundB = true; }
            if (event.field === 'X_AV_SR_CODELIVERY_FLG' && !foundC) { co_delivery = event.newValue === 'Y'; foundC = true; }
        });
        return { billable, co_delivery };
    }
}

module.exports = new ReportService();