// src/services/tokenService.ts
import crypto from 'crypto';

import type { Types } from 'mongoose';
import * as XLSX from 'xlsx';

import Token, { type IToken, type ITokenDocument } from '../models/tokenModel';

// ---------------------------------------------------------------------------
// Interfaces y tipos locales
// ---------------------------------------------------------------------------

interface UserData {
  email: string;
  name: string;
  phone: string;
}

interface ShareLinks {
  whatsapp: string;
  email: string;
}

interface ClientInfo {
  ip: string;
  deviceInfo?: string;
}

interface TokenWithShareLinks extends IToken {
  _id: Types.ObjectId;
  shareLinks: ShareLinks;
}

interface TokenWithRemainingDays {
  _id: Types.ObjectId;
  token: string;
  email: string;
  name: string;
  phone: string;
  createdAt: Date;
  expiresAt: Date;
  isRedeemed: boolean;
  redeemedAt?: Date;
  machineId?: string;
  redemptionDetails?: { ip?: string; deviceInfo?: string; timestamp?: Date };
  remainingDays: number;
}

type ValidationResult =
  | { success: false; valid: false; message: string; errorCode: string; redeemedAt?: Date }
  | { success: true; valid: true; message: string; expiresAt: Date };

export interface TokenStatusResult {
  valid: boolean;
  message: string;
  expiresAt?: Date;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

const generateShareLinks = (tokenData: ITokenDocument): ShareLinks => {
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

  const whatsappMessage = encodeURIComponent(message);
  const whatsappLink = `https://wa.me/${tokenData.phone}?text=${whatsappMessage}`;

  const emailSubject = encodeURIComponent('Tu Token de Licencia');
  const emailBody = encodeURIComponent(message);
  const emailLink = `mailto:${tokenData.email}?subject=${emailSubject}&body=${emailBody}`;

  return {
    whatsapp: whatsappLink,
    email: emailLink,
  };
};

const calculateRemainingDays = (expiresAt: Date): number => {
  const now = new Date();
  const expDate = new Date(expiresAt);
  const diffTime = expDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

// ---------------------------------------------------------------------------
// Funciones auxiliares de fecha (exportadas)
// ---------------------------------------------------------------------------

/**
 * Obtiene el primer día del mes siguiente después de X meses.
 */
export function getFirstDayOfNextMonthAfterMonths(date: Date, months: number): Date {
  const newDate = new Date(date);
  // Avanzar al mes siguiente + los meses adicionales solicitados
  newDate.setMonth(newDate.getMonth() + months);
  // Establecer el día 1 del mes
  newDate.setDate(1);
  return newDate;
}

/**
 * Añade meses a una fecha manteniendo el día.
 * Se mantiene por compatibilidad, aunque ya no se usa para renovaciones.
 */
export function addMonthsToDate(date: Date, months: number): Date {
  const newDate = new Date(date);
  const currentMonth = newDate.getMonth();
  const targetMonth = currentMonth + months;

  newDate.setMonth(targetMonth);
  return newDate;
}

// ---------------------------------------------------------------------------
// Funciones de servicio (exportadas)
// ---------------------------------------------------------------------------

export async function createToken(userData: UserData): Promise<TokenWithShareLinks> {
  const token = crypto.randomBytes(16).toString('hex');
  const createdAt = new Date();
  // La fecha de expiración será el primer día del mes siguiente
  const provisionalExpiresAt = getFirstDayOfNextMonthAfterMonths(createdAt, 1);
  const tokenRecord = new Token({ token, ...userData, createdAt, expiresAt: provisionalExpiresAt });

  try {
    await tokenRecord.save();
    // Generar links de compartir después de crear el token
    const shareLinks = generateShareLinks(tokenRecord);
    return {
      ...(tokenRecord.toObject() as IToken & { _id: Types.ObjectId }),
      shareLinks,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Error al crear el token: ${message}`);
  }
}

export async function isTokenValid(token: string): Promise<boolean> {
  const tokenRecord = await Token.findOne({ token });
  // Solo verifica existencia y que no haya expirado
  return !!(tokenRecord && new Date() <= tokenRecord.expiresAt);
}

/**
 * Verifica el estado de un token y devuelve un objeto con detalles.
 * A diferencia de isTokenValid, retorna informacion estructurada sin redimir.
 */
export async function checkTokenStatus(token: string): Promise<TokenStatusResult> {
  const tokenRecord = await Token.findOne({ token });

  if (!tokenRecord) {
    return { valid: false, message: 'Token no encontrado' };
  }

  if (tokenRecord.expiresAt && new Date() > tokenRecord.expiresAt) {
    return { valid: false, message: 'Token expirado' };
  }

  return { valid: true, message: 'Token valido', expiresAt: tokenRecord.expiresAt };
}

export async function getShareLinks(token: string): Promise<ShareLinks> {
  try {
    const tokenRecord = await Token.findOne({ token });
    if (!tokenRecord) {
      throw new Error('Token no encontrado');
    }
    return generateShareLinks(tokenRecord);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Error al generar enlaces de compartir: ${message}`);
  }
}

export async function validateToken(token: string): Promise<boolean> {
  const record = await Token.findOne({ token });
  if (!record) {
    return false;
  }
  return new Date() <= record.expiresAt;
}

export async function getTokensExpiringSoon(days: number = 7): Promise<ITokenDocument[]> {
  const now = new Date();
  const upcomingDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return Token.find({
    expiresAt: { $gte: now, $lte: upcomingDate },
    isRedeemed: true,
  }).sort({ expiresAt: 1 });
}

export async function getAllTokens(
  skip: number = 0,
  limit: number = 0,
): Promise<TokenWithRemainingDays[]> {
  let query = Token.find({}).sort({ createdAt: -1 }).skip(skip);
  if (limit > 0) {
    query = query.limit(limit);
  }
  const tokens = await query;
  return tokens.map((token) => ({
    ...(token.toObject() as IToken & { _id: Types.ObjectId }),
    remainingDays: calculateRemainingDays(token.expiresAt),
  }));
}

export async function getTotalTokens(): Promise<number> {
  return Token.countDocuments({});
}

/**
 * Exporta la información de los tokens a un archivo Excel (formato .xlsx).
 */
export async function exportToExcel(): Promise<Buffer> {
  const tokens = await Token.find({}).sort({ createdAt: -1 });

  // Mapear cada token a un objeto con el formato deseado
  const data = tokens.map((token) => {
    const remainingDays = calculateRemainingDays(token.expiresAt);
    const isActive = remainingDays > 0;

    return {
      Token: token.token,
      Email: token.email,
      Nombre: token.name,
      Teléfono: token.phone,
      'Fecha de Alta': token.createdAt.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      'Fecha de Expiración': token.expiresAt.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      'Días Restantes': remainingDays,
      Estado: isActive ? 'Activo' : 'Expirado',
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
    { wch: 10 }, // Estado
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tokens');

  // Escribir el libro en un Buffer con formato 'xlsx'
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buffer;
}

/**
 * Valida y canjea (redime) un token.
 * Al redimirlo, se actualiza la fecha de expiración al primer día del mes siguiente.
 */
export async function validateAndRedeemToken(
  token: string,
  machineId: string,
  clientInfo: ClientInfo,
): Promise<ValidationResult> {
  const tokenRecord = await Token.findOne({ token });

  if (!tokenRecord) {
    return { success: false, valid: false, message: 'Token no encontrado', errorCode: 'TOKEN_NOT_FOUND' };
  }

  if (tokenRecord.isRedeemed) {
    return {
      success: false,
      valid: false,
      message: 'Token ya ha sido utilizado',
      errorCode: 'TOKEN_ALREADY_REDEEMED',
      redeemedAt: tokenRecord.redeemedAt,
    };
  }

  if (tokenRecord.expiresAt && new Date() > tokenRecord.expiresAt) {
    return { success: false, valid: false, message: 'Token expirado', errorCode: 'TOKEN_EXPIRED' };
  }

  const redeemedAt = new Date();
  tokenRecord.isRedeemed = true;
  tokenRecord.redeemedAt = redeemedAt;
  tokenRecord.machineId = machineId;
  tokenRecord.redemptionDetails = {
    ip: clientInfo.ip,
    deviceInfo: clientInfo.deviceInfo || 'No proporcionado',
    timestamp: redeemedAt,
  };

  // Establecer la fecha de expiración al primer día del mes siguiente
  tokenRecord.expiresAt = getFirstDayOfNextMonthAfterMonths(redeemedAt, 1);
  await tokenRecord.save();

  return {
    success: true,
    valid: true,
    message: 'Token validado y activado correctamente',
    expiresAt: tokenRecord.expiresAt,
  };
}

/**
 * Obtener tokens expirados.
 */
export async function getExpiredTokens(): Promise<ITokenDocument[]> {
  const now = new Date();
  return Token.find({
    expiresAt: { $lt: now },
  }).sort({ expiresAt: 1 });
}

/**
 * Eliminar un token por su valor.
 */
export async function deleteToken(tokenValue: string): Promise<boolean> {
  const result = await Token.deleteOne({ token: tokenValue });
  return result.deletedCount > 0;
}

/**
 * Renovar token por meses.
 */
export async function renewToken(tokenId: string, months: number): Promise<ITokenDocument> {
  const token = await Token.findOne({ token: tokenId });
  if (!token) {
    throw new Error('Token no encontrado');
  }

  // Siempre usar la fecha actual como base y establecer al primer día del mes siguiente
  const now = new Date();

  // Calcular la nueva fecha de expiración como el primer día del mes después de los meses solicitados
  const newExpiryDate = getFirstDayOfNextMonthAfterMonths(now, months);

  token.expiresAt = newExpiryDate;
  await token.save();

  return token;
}
