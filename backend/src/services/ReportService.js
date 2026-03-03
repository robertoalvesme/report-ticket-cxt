const https = require('https');
const cheerio = require('cheerio');
const { NtlmClient } = require('axios-ntlm');

class ReportService {
    constructor() {
        this.auditUrl = 'https://report.avaya.com/siebelreports/audittrail.aspx';
        this.detailsUrl = 'https://report.avaya.com/siebelreports/casedetails.aspx';

        // --- CONFIGURAÇÃO DE CREDENCIAIS VIA .ENV ---
        const fullUser = process.env.REPORT_USER || '';
        const pass = process.env.REPORT_PASS || '';

        if (!fullUser || !pass) {
            console.error('[ReportService] ERRO CRÍTICO: Variáveis REPORT_USER ou REPORT_PASS não definidas no .env');
        }

        let domain = '';
        let username = fullUser;

        if (fullUser.includes('\\')) {
            const parts = fullUser.split('\\');
            domain = parts[0];
            username = parts[1];
        }

        this.credentials = {
            username: username,
            password: pass,
            domain: domain
        };

        this.httpsAgent = new https.Agent({
            rejectUnauthorized: false,
            keepAlive: true
        });
    }

    async getTicketFullDetails(ticketNumber) {
        try {
            console.log(`[ReportService] Buscando dados para: ${ticketNumber} via NTLM`);

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
            const urlObj = new URL(baseUrl);
            Object.keys(params).forEach(key => urlObj.searchParams.append(key, params[key]));
            const finalUrl = urlObj.toString();

            const ntlmClient = NtlmClient({
                username: this.credentials.username,
                password: this.credentials.password,
                domain: this.credentials.domain,
            });

            const response = await ntlmClient.get(finalUrl, {
                httpsAgent: this.httpsAgent,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Connection': 'keep-alive'
                }
            });

            return response.data;
        } catch (error) {
            if (error.response) {
                console.error(`[Erro HTTP ${error.response.status}] Headers:`, error.response.headers);
            }
            throw new Error(`Falha no request NTLM para ${baseUrl}: ${error.message}`);
        }
    }

    _parseCaseDetails(html) {
        const $ = cheerio.load(html);
        const creditRiskVal = this._extractDetailField($, 'Credit Risk');
        return {
            creditRisk: creditRiskVal === 'Y',
            source: this._extractDetailField($, 'Source'),
            resolutionNote: this._extractDetailField($, 'SR Resolution Note'),
            serviceAction: this._extractDetailField($, 'Service Action'),
            resolutionAction: this._extractDetailField($, 'Resolution Action'),
            resolutionDetail: this._extractDetailField($, 'Resolution Detail'),
            srOwner: this._extractDetailField($, 'SR Owner'),
            srAgeDays: this._extractDetailField($, 'SR Age (days)')
        };
    }

    _extractDetailField($, labelText) {
        let foundValue = null;
        $('span').each((i, el) => {
            const text = $(el).text().trim();
            if (text === labelText || text === labelText + ':') {
                const parentTd = $(el).closest('td');
                const nextTd = parentTd.next('td');
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

        if (rows.length === 0) {
            console.warn('[ReportService] Aviso: Nenhuma linha de auditoria encontrada.');
        }

        // Ordena Cronologicamente
        const sortedRows = rows.sort((a, b) => a.timestamp - b.timestamp);

        // 1. Tenta encontrar a atribuição PARA o CXT_GLOBAL
        let assignmentEvent = sortedRows.find(row =>
            row.field === 'Owner' && row.newValue === 'CXT_GLOBAL'
        );

        // 2. Fallback: Se o log omitiu a entrada, procura quando ele SAIU do CXT_GLOBAL
        if (!assignmentEvent) {
            assignmentEvent = sortedRows.find(row =>
                row.field === 'Owner' && row.oldValue === 'CXT_GLOBAL'
            );
        }

        // 3. Fallback: Se não tem rastro do CXT, procura o primeiro assignment humano
        if (!assignmentEvent) {
            assignmentEvent = sortedRows.find(row =>
                row.field === 'Owner' &&
                row.newValue &&
                !['CXT_GLOBAL', 'TANGO', 'Unassigned', ''].includes(row.newValue)
            );
        }

        let relevantEvents;
        if (assignmentEvent) {
            // Pega todo o rastro ATÉ o exato momento onde foi para um engenheiro/CXT
            const cutoffTime = assignmentEvent.timestamp;
            relevantEvents = sortedRows.filter(row => row.timestamp <= cutoffTime);
        } else {
            relevantEvents = sortedRows;
        }

        return this._calculateFlags(relevantEvents);
    }

    _extractAuditRows($) {
        const rows = [];
        const $rows = $('table tr');

        if ($rows.length === 0) return rows;

        let idxDate = 7;
        let idxField = 2;
        let idxOldVal = 3; // NOVA COLUNA ADICIONADA AQUI
        let idxNewVal = 4;

        const $header = $rows.first();
        $header.find('td').each((i, el) => {
            const txt = $(el).text().trim().toUpperCase();
            if (txt === 'CREATED') idxDate = i;
            if (txt === 'OBJECT_NAME') idxField = i;
            if (txt === 'OLD_VALUE') idxOldVal = i;
            if (txt === 'NEW_VALUE') idxNewVal = i;
        });

        $rows.each((i, elem) => {
            if (i === 0) return;

            const cols = $(elem).find('td');
            if (cols.length > Math.max(idxDate, idxField, idxOldVal, idxNewVal)) {

                const dateStr = $(cols[idxDate]).text().trim();
                const fieldName = $(cols[idxField]).text().trim();
                const oldVal = $(cols[idxOldVal]).text().trim(); // EXTRAÇÃO DO VALOR ANTIGO
                const newVal = $(cols[idxNewVal]).text().trim();

                if (!dateStr || dateStr === 'CREATED') return;

                const timestamp = this._parseDateUS(dateStr);

                if (timestamp > 0) {
                    rows.push({
                        dateRaw: dateStr,
                        timestamp: timestamp,
                        field: fieldName,
                        oldValue: oldVal,
                        newValue: newVal
                    });
                }
            }
        });
        return rows;
    }

    _parseDateUS(dateStr) {
        try {
            const cleanStr = dateStr.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();

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

        // Flags de controle para garantir que apenas o PRIMEIRO valor seja considerado
        let foundBillable = false;
        let foundCodelivery = false;

        events.forEach(event => {
            if (event.field === 'BILLABLE_FLG' && !foundBillable) {
                billable = event.newValue === 'Y';
                foundBillable = true; // Trava para não ser sobrescrito por mudanças futuras
            }
            if (event.field === 'X_AV_SR_CODELIVERY_FLG' && !foundCodelivery) {
                co_delivery = event.newValue === 'Y';
                foundCodelivery = true; // Trava
            }
        });

        return { billable, co_delivery };
    }
}

module.exports = new ReportService();