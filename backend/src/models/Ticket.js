const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
    // --- Dados vindos do Endpoint 1 (Lista/Eventos) ---
    event_id: {
        type: String,
        required: true,
        unique: true, // Garante que não duplicaremos eventos
        index: true   // Facilita a busca rápida
    },
    event_name: String,
    activity_number: {
        type: String,
        index: true // Vamos usar isso para buscar o detalhe no Endpoint 2
    },
    activity_severity_name: String, // ex: NBI, BI
    queue_name: String,             // ex: CXT_GLOBAL
    user_name: String,              // ID do engenheiro
    user_flu_name: String,          // Nome completo do engenheiro
    customer_name: String,
    entered_time: String,           // Timestamp vindo da API
    activity_type_name: String,     // ex: Break/Fix
    activity_skill_name: String,    // ex: CCS/SES

    // --- Dados vindos do Endpoint 2 (Detalhes) ---
    // Armazenamos dentro de um objeto 'detail' conforme sua solicitação
    detail: {
        activity_id: String,
        activity_status_name: String, // Importante para o gráfico (ex: Completed, Open)
        activity_description: String,
        activity_closed: String,      // "0" ou "1"
        owner_flu_name: String,       // Dono atual do ticket
        created_date: String,
        updated_date: String,
        // Podemos permitir campos flexíveis aqui caso a API mude
        // mas definimos os principais acima para indexação.
    },

    // --- Campos de Controle da Nossa Aplicação ---
    last_updated_at: {
        type: Date,
        default: Date.now
    }
});

// Método estático para facilitar salvar ou atualizar (Upsert)
TicketSchema.statics.upsertTicket = async function(ticketData) {
    return this.findOneAndUpdate(
        { event_id: ticketData.event_id }, // Busca por event_id
        ticketData,                        // Dados a atualizar
        { upsert: true, new: true }        // Cria se não existir
    );
};

module.exports = mongoose.model('Ticket', TicketSchema);