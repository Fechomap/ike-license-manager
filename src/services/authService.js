// src/services/authService.js
const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * Genera un token JWT usando los datos del usuario.
 *
 * @param {Object} payload - Los datos que deseas incluir en el token.
 * @param {string} [expiresIn='1h'] - Tiempo de expiración del token (opcional).
 * @returns {string} Token JWT firmado.
 */
exports.generateToken = (payload, expiresIn = '1h') => {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
};

/**
 * Verifica y decodifica un token JWT.
 *
 * @param {string} token - El token JWT a verificar.
 * @returns {Object} Los datos decodificados si el token es válido.
 */
exports.verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    throw new Error('Token inválido o expirado');
  }
};