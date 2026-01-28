const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
    event_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    event_name: String,
    activity_number: {
        type: String,
        index: true
    },
    activity_severity_name: String,
    queue_name: String,
    user_name: String,
    user_flu_name: String,
    user_first_name: String, // Adicionado para garantir
    user_last_name: String,  // Adicionado para garantir
    customer_fl: String,     // Adicionado para garantir
    customer_name: String,
    entered_time: String,
    activity_type_name: String,
    activity_skill_name: String,

    // --- NOVOS CAMPOS ADICIONADOS ---
    billable: String,
    credit_risk: String,
    co_delivery: String,
    // ---------------------------------

    detail: {
        activity_id: String,
        activity_status_name: String,
        activity_description: String,
        activity_closed: String,
        owner_flu_name: String,
        created_date: String,
        updated_date: String,
    },

    last_updated_at: {
        type: Date,
        default: Date.now
    }
});

TicketSchema.statics.upsertTicket = async function(ticketData) {
    return this.findOneAndUpdate(
        { event_id: ticketData.event_id },
        ticketData,
        { upsert: true, new: true }
    );
};

module.exports = mongoose.model('Ticket', TicketSchema);