const mongoose = require('mongoose');

const connectDB = async () => {
    // Tenta conectar infinitamente até conseguir (para esperar o Docker do Mongo)
    const connectWithRetry = () => {
        console.log('MongoDB: Tentando conectar...');
        mongoose.connect(process.env.MONGO_URI)
            .then(() => {
                console.log('MongoDB Conectado');
            })
            .catch((err) => {
                console.error('MongoDB falha na conexão, tentando novamente em 5s...', err.message);
                setTimeout(connectWithRetry, 5000);
            });
    };

    connectWithRetry();
};

module.exports = connectDB;