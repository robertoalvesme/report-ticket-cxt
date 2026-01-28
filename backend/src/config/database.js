const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Substitua pela sua string de conexão real (local ou Atlas)
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dashboard_ocd', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log(`MongoDB Conectado: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Erro ao conectar no Mongo: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;