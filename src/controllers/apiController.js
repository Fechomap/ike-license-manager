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
    const tokens = await tokenService.getAllTokens();
    return res.json(tokens);
  } catch (error) {
    console.error('Error obteniendo tokens:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener tokens' });
  }
};