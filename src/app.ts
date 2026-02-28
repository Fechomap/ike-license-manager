// src/app.ts
import express, { type Request, type Response } from 'express';

import config from './config/config';
import connectDB from './config/database';
import apiRoutes from './routes/apiRoutes';
import telegramService from './services/telegramService';

const app = express();
const PORT = config.port;

// Middlewares
app.use(express.json());
app.use('/api', apiRoutes);

// Endpoint para webhook de Telegram (solo en produccion)
if (config.isProduction) {
  app.post('/api/telegram-webhook', (req: Request, res: Response) => {
    telegramService.bot.processUpdate(req.body);
    res.sendStatus(200);
  });
}

// Iniciar servidor y servicios
const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`\u{1f680} Servidor corriendo en puerto ${PORT}`);
      console.log(
        `\u{1f4cd} Modo: ${config.isProduction ? 'Produccion (Webhook)' : 'Desarrollo (Polling)'}`,
      );
    });

    console.log('\u{2705} Servicio de Telegram iniciado');
  } catch (error) {
    console.error('\u{274c} Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

void startServer();
