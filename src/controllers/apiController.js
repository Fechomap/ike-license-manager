// src/controllers/apiController.js
const tokenService = require('../services/tokenService');

exports.validateToken = async (req, res) => {
  try {
    const { token, machineId, deviceInfo } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    if (!token || !machineId) {
      return res.status(400).json({
        success: false,
        message: 'Token y machineId son requeridos'
      });
    }

    const validationResult = await tokenService.validateAndRedeemToken(
      token,
      machineId,
      {
        ip: clientIp,
        deviceInfo: deviceInfo || 'No proporcionado'
      }
    );

    return res.json(validationResult);
  } catch (error) {
    console.error('Error validando token:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al validar el token',
      error: error.message
    });
  }
};

exports.getAllTokens = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5; // Cantidad de tokens a enviar por página
    const skip = (page - 1) * limit;

    const tokens = await tokenService.getAllTokens(skip, limit);
    const totalTokens = await tokenService.getTotalTokens();

    const response = {
      tokens,
      currentPage: page,
      totalPages: Math.ceil(totalTokens / limit),
    };

    // Aquí envías los tokens por partes a través del bot de Telegram
    await sendTokensToTelegram(tokens);

    return res.json(response);
  } catch (error) {
    console.error('Error obteniendo tokens:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener tokens' });
  }
};

async function sendTokensToTelegram(tokens) {
  // Aquí escribes la lógica para enviar los tokens de 5 en 5 a través del bot de Telegram
  for (const token of tokens) {
    // Construye el mensaje a enviar y envíalo al bot
    const message = `Token: ${token.token}\nUsuario: ${token.user}\nEmail: ${token.email}\nEstado: ${token.status}\nDías restantes: ${token.daysRemaining}`;
    await telegramService.sendMessage(process.env.ADMIN_CHAT_ID, message);
  }
}