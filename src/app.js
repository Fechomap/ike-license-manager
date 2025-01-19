const express = require('express');
const app = express();
const connectDB = require('./config/database');
const apiRoutes = require('./routes/apiRoutes');
const telegramService = require('./services/telegramService');

const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use('/api', apiRoutes);

// Iniciar servidor y servicios
const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    });

    // El servicio de Telegram ya se inicializa en su constructor
    console.log('✅ Servicio de Telegram iniciado');
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();