// src/services/tokenService.js
const crypto = require('crypto');
const Token = require('../models/tokenModel');
const XLSX = require('xlsx');

const generateShareLinks = (tokenData) => {
  // Preparar el mensaje
  const message = `
¡Tu token de licencia está listo!

Token: ${tokenData.token}
Válido hasta: ${tokenData.expiresAt.toLocaleDateString()}

IMPORTANTE:
- Este token solo puede ser redimido una vez
- Solo puede ser usado en un dispositivo
- El mal uso puede resultar en cancelación

Si tienes dudas, contáctanos.
  `.trim();

  // Generar link para WhatsApp
  const whatsappMessage = encodeURIComponent(message);
  const whatsappLink = `https://wa.me/${tokenData.phone}?text=${whatsappMessage}`;

  // Generar contenido para email
  const emailSubject = encodeURIComponent('Tu Token de Licencia');
  const emailBody = encodeURIComponent(message);
  const emailLink = `mailto:${tokenData.email}?subject=${emailSubject}&body=${emailBody}`;

  return {
    whatsapp: whatsappLink,
    email: emailLink
  };
};

exports.createToken = async (userData) => {
  const token = crypto.randomBytes(16).toString('hex');
  const createdAt = new Date();
  const provisionalExpiresAt = new Date(createdAt.getTime() + 365 * 24 * 60 * 60 * 1000);
  const tokenRecord = new Token({ token, ...userData, createdAt, expiresAt: provisionalExpiresAt });
  
  try {
    await tokenRecord.save();
    // Generar links de compartir después de crear el token
    const shareLinks = generateShareLinks(tokenRecord);
    return {
      ...tokenRecord.toObject(),
      shareLinks
    };
  } catch (error) {
    throw new Error(`Error al crear el token: ${error.message}`);
  }
};


exports.isTokenValid = async (token) => {
  const tokenRecord = await Token.findOne({ token });
  // Solo verifica existencia y que no haya expirado
  return !!(tokenRecord && new Date() <= tokenRecord.expiresAt);
};


exports.getShareLinks = async (token) => {
  try {
    const tokenRecord = await Token.findOne({ token });
    if (!tokenRecord) {
      throw new Error('Token no encontrado');
    }
    return generateShareLinks(tokenRecord);
  } catch (error) {
    throw new Error(`Error al generar enlaces de compartir: ${error.message}`);
  }
};

// Las funciones existentes se mantienen igual
exports.validateToken = async (token) => {
  const record = await Token.findOne({ token });
  if (!record) return false;
  return new Date() <= record.expiresAt;
};

exports.getTokensExpiringSoon = async (days = 7) => {
  const now = new Date();
  const upcomingDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return await Token.find({
    expiresAt: { $gte: now, $lte: upcomingDate },
    isRedeemed: true
  }).sort({ expiresAt: 1 });
};

exports.getAllTokens = async () => {
  const tokens = await Token.find({}).sort({ createdAt: -1 });
  return tokens.map(token => ({
    ...token.toObject(),
    remainingDays: calculateRemainingDays(token.expiresAt)
  }));
};

const calculateRemainingDays = (expiresAt) => {
  const now = new Date();
  const expDate = new Date(expiresAt);
  const diffTime = expDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

/**
 * Exporta la información de los tokens a un archivo Excel (formato .xlsx).
 */
exports.exportToExcel = async () => {
  const tokens = await Token.find({}).sort({ createdAt: -1 });
  
  // Mapear cada token a un objeto con el formato deseado
  const data = tokens.map(token => {
    const remainingDays = calculateRemainingDays(token.expiresAt);
    const isActive = remainingDays > 0;
    
    return {
      'Token': token.token,
      'Email': token.email,
      'Nombre': token.name,
      'Teléfono': token.phone,
      'Fecha de Alta': token.createdAt.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      'Fecha de Expiración': token.expiresAt.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      'Días Restantes': remainingDays,
      'Estado': isActive ? 'Activo' : 'Expirado'
    };
  });

  // Crear un libro nuevo y una hoja a partir de los datos
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Establecer anchos de columna
  worksheet['!cols'] = [
    { wch: 35 }, // Token
    { wch: 25 }, // Email
    { wch: 20 }, // Nombre
    { wch: 15 }, // Teléfono
    { wch: 20 }, // Fecha de Alta
    { wch: 20 }, // Fecha de Expiración
    { wch: 15 }, // Días Restantes
    { wch: 10 }  // Estado
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tokens');

  // Escribir el libro en un Buffer con formato 'xlsx'
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
};

/**
 * Valida y canjea (redime) un token.
 * Al redimirlo, se actualiza la fecha de expiración a 30 días desde ese momento.
 */
exports.validateAndRedeemToken = async (token, machineId, clientInfo) => {
  const tokenRecord = await Token.findOne({ token });

  if (!tokenRecord) {
    return { success: false, message: 'Token no encontrado' };
  }

  if (tokenRecord.isRedeemed) {
    return {
      success: false,
      message: 'Token ya ha sido utilizado',
      redeemedAt: tokenRecord.redeemedAt
    };
  }

  if (tokenRecord.expiresAt && new Date() > tokenRecord.expiresAt) {
    return { success: false, message: 'Token expirado' };
  }

  const redeemedAt = new Date();
  tokenRecord.isRedeemed = true;
  tokenRecord.redeemedAt = redeemedAt;
  tokenRecord.machineId = machineId;
  tokenRecord.redemptionDetails = {
    ip: clientInfo.ip,
    deviceInfo: clientInfo.deviceInfo || 'No proporcionado',
    timestamp: redeemedAt
  };

  // Actualizar la fecha de expiración para que sean 30 días a partir de la redención
  tokenRecord.expiresAt = new Date(redeemedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  await tokenRecord.save();

  return {
    success: true,
    message: 'Token validado y activado correctamente',
    expiresAt: tokenRecord.expiresAt
  };
};

// Obtener tokens expirados
exports.getExpiredTokens = async () => {
  const now = new Date();
  return await Token.find({
    expiresAt: { $lt: now }
  }).sort({ expiresAt: 1 });
};

// Función auxiliar para añadir meses a una fecha manteniendo el día
exports.addMonthsToDate = (date, months) => {
  const newDate = new Date(date);
  const currentMonth = newDate.getMonth();
  const targetMonth = currentMonth + months;
  
  newDate.setMonth(targetMonth);
  return newDate;
};

// Renovar token por meses
exports.renewToken = async (tokenId, months) => {
  const token = await Token.findOne({ token: tokenId });
  if (!token) {
    throw new Error('Token no encontrado');
  }

  const now = new Date();
  let baseDate;

  // Determinar la fecha base para la renovación
  if (token.expiresAt > now) {
    // Si el token aún no ha expirado, usar su fecha de expiración como base
    baseDate = token.expiresAt;
  } else {
    // Si el token ya expiró, usar la fecha actual como base
    baseDate = now;
  }

  // Añadir los meses a la fecha base
  const newExpiryDate = this.addMonthsToDate(baseDate, months);
  token.expiresAt = newExpiryDate;
  await token.save();
  
  return token;
};