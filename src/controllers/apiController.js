// src/controllers/apiController.js
const tokenService = require('../services/tokenService');
// Asegúrate de requerir tu servicio de telegram:
const telegramService = require('../services/telegramService');
// ^ Ajustar según cómo tengas organizado tu proyecto

exports.validateToken = async (req, res) => {
  try {
    const { token, machineId, deviceInfo } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress;

    if (!token || !machineId) {
      return res.status(400).json({
        success: false,
        message: 'Token y machineId son requeridos',
      });
    }

    const validationResult = await tokenService.validateAndRedeemToken(token, machineId, {
      ip: clientIp,
      deviceInfo: deviceInfo || 'No proporcionado',
    });

    return res.json(validationResult);
  } catch (error) {
    console.error('Error validando token:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al validar el token',
      error: error.message,
    });
  }
};

exports.checkTokenValidity = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.json(false);
    }

    const isValid = await tokenService.isTokenValid(token);
    return res.json(isValid);
  } catch (error) {
    return res.json(false);
  }
};

exports.getAllTokens = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5; // Cantidad de tokens por página
    const skip = (page - 1) * limit;

    const tokens = await tokenService.getAllTokens(skip, limit);
    const totalTokens = await tokenService.getTotalTokens();

    // Enviamos los tokens obtenidos a Telegram (en múltiples mensajes si es grande)
    await sendTokensToTelegram(tokens);

    const response = {
      tokens,
      currentPage: page,
      totalPages: Math.ceil(totalTokens / limit),
    };

    return res.json(response);
  } catch (error) {
    console.error('Error obteniendo tokens:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener tokens',
    });
  }
};

/**
 * Envía la lista de tokens al chat de Telegram configurado.
 * Si el mensaje sobrepasa los 4096 caracteres de Telegram,
 * se dividirá automáticamente en chunks para evitar el error "message is too long".
 */
async function sendTokensToTelegram(tokens) {
  // Puedes agruparlos de 10 en 10, o simplemente trabajar con todos.
  // El punto crítico es dividir el texto por longitud para evitar el límite.

  // 1. Creamos un string con la información de cada token
  let message = '📋 *Lista de tokens:*\n\n'; // Markdown o texto plano
  for (const token of tokens) {
    message +=
      `🔑 *Token:* ${token.token}\n` +
      `👤 *Usuario:* ${token.name}\n` +
      `📧 *Email:* ${token.email}\n` +
      `📅 *Estado:* ${token.isRedeemed ? 'Canjeado' : 'No canjeado'}\n` +
      `⏰ *Días restantes:* ${token.remainingDays}\n\n`;
  }

  // 2. Telegram tiene un límite de ~4096 caracteres en el cuerpo de un mensaje.
  //    Usamos chunkSize = 4000 como margen de seguridad.
  const chunkSize = 4000;
  let startIndex = 0;

  // 3. Mientras haya texto por enviar, enviamos trozos de 4000 caracteres.
  while (startIndex < message.length) {
    const messageChunk = message.slice(startIndex, startIndex + chunkSize);
    // Envía cada parte al chat de admin (ADMIN_CHAT_ID en tus variables .env)
    await telegramService.bot.sendMessage(process.env.ADMIN_CHAT_ID, messageChunk, {
      parse_mode: 'Markdown',
      // O 'HTML' si prefieres. Ajusta si no utilizas formato Markdown.
    });
    startIndex += chunkSize;
  }
}
