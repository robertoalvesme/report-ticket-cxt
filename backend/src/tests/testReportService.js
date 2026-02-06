const fs = require('fs');
const path = require('path');
const reportService = require('../services/ReportService'); // Caminho corrigido (plural)

// Mock manual da função _fetchHtml para não bater na rede durante o teste de lógica
reportService._fetchHtml = async () => { throw new Error("Network calls not allowed in logic test"); };

async function runTests() {
    console.log('--- Iniciando Testes do ReportService ---\n');

    // --- CARREGAR ARQUIVOS HTML (Simulação) ---
    // Ajuste os nomes dos arquivos para o caminho onde você salvou os uploads
    const casedetailsPath = path.join(__dirname, 'creditrisk-casedetails.html');
    const audittrailPath = path.join(__dirname, '1-23451112812-billable-audittrail.html');

    // Leitura síncrona para o teste
    let casedetailsHtml = '';
    let audittrailHtml = '';

    try {
        casedetailsHtml = fs.readFileSync(casedetailsPath, 'utf8');
        audittrailHtml = fs.readFileSync(audittrailPath, 'utf8');
    } catch (err) {
        console.error("Erro ao ler arquivos de teste. Verifique se os arquivos HTML estão na mesma pasta deste script.");
        console.error(err.message);
        return;
    }

    // --- TESTE 1: Case Details ---
    console.log('TESTE 1: Parsing Case Details');
    try {
        // Acessando método privado para teste unitário (em JS isso é permitido)
        const resultDetails = reportService._parseCaseDetails(casedetailsHtml);

        console.log('Resultado JSON:', JSON.stringify(resultDetails, null, 2));

        // Verificações visuais (Asserções)
        if (resultDetails.source !== undefined && resultDetails.resolutionNote !== undefined) {
            console.log('✅ PASS: Campos esperados encontrados.');
        } else {
            console.log('❌ FAIL: Campos faltando.');
        }
    } catch (error) {
        console.error('❌ FAIL: Erro ao processar Case Details:', error);
    }

    console.log('\n---------------------------------------------------\n');

    // --- TESTE 2: Audit Trail ---
    console.log('TESTE 2: Parsing Audit Trail');
    try {
        // Acessando método privado para teste unitário
        const resultAudit = reportService._parseAuditTrail(audittrailHtml);

        console.log('Resultado JSON:', JSON.stringify(resultAudit, null, 2));

        // Verificações visuais
        if (typeof resultAudit.billable === 'boolean' && typeof resultAudit.co_delivery === 'boolean') {
            console.log('✅ PASS: Flags booleanas retornadas corretamente.');
        } else {
            console.log('❌ FAIL: Formato de retorno inválido.');
        }

    } catch (error) {
        console.error('❌ FAIL: Erro ao processar Audit Trail:', error);
    }
}

runTests();