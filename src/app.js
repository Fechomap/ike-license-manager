const express = require('express');
const app = express();
const connectDB = require('./config/database');
const apiRoutes = require('./routes/apiRoutes');
const telegramService = require('./services/telegramService');
const config = require('./config/config');

const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use('/api', apiRoutes);

// Endpoint para webhook de Telegram (solo en producción)
if (config.isProduction) {
  app.post('/api/telegram-webhook', (req, res) => {
    telegramService.bot.processUpdate(req.body);
    res.sendStatus(200);
  });
}

// Iniciar servidor y servicios
const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📍 Modo: ${config.isProduction ? 'Producción (Webhook)' : 'Desarrollo (Polling)'}`);
    });

    console.log('✅ Servicio de Telegram iniciado');
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();