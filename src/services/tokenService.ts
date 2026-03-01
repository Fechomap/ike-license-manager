// src/services/tokenService.ts
import crypto from 'crypto';

import * as XLSX from 'xlsx';

import type { Token } from '../generated/prisma/client';
import { TokenStatus } from '../generated/prisma/enums';
import prisma from '../lib/prisma';
import { getRedemptionDetails } from '../models/tokenModel';

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

interface TokenWithShareLinks {
  id: string;
  token: string;
  email: string;
  name: string;
  phone: string;
  createdAt: Date;
  expiresAt: Date;
  isRedeemed: boolean;
  redeemedAt: Date | null;
  machineId: string | null;
  status: TokenStatus;
  statusReason: string | null;
  shareLinks: ShareLinks;
}

export interface TokenWithRemainingDays {
  id: string;
  token: string;
  email: string;
  name: string;
  phone: string;
  createdAt: Date;
  expiresAt: Date;
  isRedeemed: boolean;
  redeemedAt: Date | null;
  machineId: string | null;
  status: TokenStatus;
  statusReason: string | null;
  redemptionDetails?: { ip?: string; deviceInfo?: string; timestamp?: Date };
  remainingDays: number;
}

type ValidationResult =
  | { success: false; valid: false; message: string; errorCode: string; redeemedAt?: Date | null }
  | { success: true; valid: true; message: string; expiresAt: Date };

export interface TokenStatusResult {
  valid: boolean;
  status: string;
  expiresAt: string;
  message: string;
  reason?: string;
  graceDaysRemaining?: number;
  daysUntilExpiration?: number;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const GRACE_PERIOD_DAYS = 5;
const EXPIRING_SOON_DAYS = 5;

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

const generateShareLinks = (tokenData: Token): ShareLinks => {
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
 * Obtiene el primer día del mes siguiente después de X meses (en UTC).
 * Usa métodos UTC para que el resultado sea idéntico sin importar
 * la timezone del servidor (CDMX, Railway/UTC, etc.).
 */
export function getFirstDayOfNextMonthAfterMonths(date: Date, months: number): Date {
  const newDate = new Date(date);
  // Avanzar los meses solicitados (en UTC)
  newDate.setUTCMonth(newDate.getUTCMonth() + months);
  // Establecer el día 1 del mes resultante (en UTC)
  newDate.setUTCDate(1);
  // Normalizar hora a medianoche UTC para cortes limpios
  newDate.setUTCHours(0, 0, 0, 0);
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

  try {
    const tokenRecord = await prisma.token.create({
      data: {
        token,
        email: userData.email,
        name: userData.name,
        phone: userData.phone,
        createdAt,
        expiresAt: provisionalExpiresAt,
      },
    });

    const shareLinks = generateShareLinks(tokenRecord);
    return {
      ...tokenRecord,
      shareLinks,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Error al crear el token: ${message}`);
  }
}

/**
 * Verifica el estado de un token y devuelve un objeto con detalles.
 * Retorna null si el token no existe (el controller decide el HTTP status).
 *
 * Lógica de periodo de gracia:
 * - Cuando un token expira por fecha, se otorgan 5 días de gracia.
 * - Durante la gracia: valid=true, status='grace_period', graceDaysRemaining=N.
 * - Pasados los 5 días: se auto-suspende el token en BD.
 */
export async function checkTokenStatus(token: string): Promise<TokenStatusResult | null> {
  const tokenRecord = await prisma.token.findUnique({ where: { token } });

  if (!tokenRecord) {
    return null;
  }

  const expiresAtISO = tokenRecord.expiresAt.toISOString();
  const now = new Date();

  // Verificar status administrativo primero (sin gracia)
  if (
    tokenRecord.status === TokenStatus.suspended ||
    tokenRecord.status === TokenStatus.cancelled
  ) {
    return {
      valid: false,
      status: tokenRecord.status,
      expiresAt: expiresAtISO,
      message: `Token ${tokenRecord.status}`,
      reason: tokenRecord.statusReason ?? undefined,
    };
  }

  // Verificar expiración por fecha
  if (now > tokenRecord.expiresAt) {
    const msSinceExpiration = now.getTime() - tokenRecord.expiresAt.getTime();
    const daysSinceExpiration = Math.floor(msSinceExpiration / (1000 * 60 * 60 * 24));

    if (daysSinceExpiration < GRACE_PERIOD_DAYS) {
      // Periodo de gracia activo: la app sigue funcionando pero muestra advertencia
      const graceDaysRemaining = GRACE_PERIOD_DAYS - daysSinceExpiration;
      return {
        valid: true,
        status: 'grace_period',
        expiresAt: expiresAtISO,
        message: 'Token expirado - periodo de gracia',
        graceDaysRemaining,
      };
    }

    // Periodo de gracia vencido → auto-suspender en BD
    await prisma.token.update({
      where: { token },
      data: {
        status: TokenStatus.suspended,
        statusReason: 'Periodo de gracia vencido sin pago',
      },
    });

    return {
      valid: false,
      status: 'suspended',
      expiresAt: expiresAtISO,
      message: 'Token suspendido',
      reason: 'Periodo de gracia vencido sin pago',
    };
  }

  // Verificar si está próximo a expirar
  const daysUntilExpiration = calculateRemainingDays(tokenRecord.expiresAt);
  if (daysUntilExpiration <= EXPIRING_SOON_DAYS) {
    return {
      valid: true,
      status: 'expiring_soon',
      expiresAt: expiresAtISO,
      message: 'Token próximo a expirar',
      daysUntilExpiration,
    };
  }

  return {
    valid: true,
    status: 'active',
    expiresAt: expiresAtISO,
    message: 'Token valido',
  };
}

export async function getTokensExpiringSoon(days: number = 7): Promise<Token[]> {
  const now = new Date();
  const upcomingDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return prisma.token.findMany({
    where: {
      expiresAt: { gte: now, lte: upcomingDate },
      isRedeemed: true,
      status: TokenStatus.active,
    },
    orderBy: { expiresAt: 'asc' },
  });
}

export async function getAllTokens(
  skip: number = 0,
  limit: number = 0,
): Promise<TokenWithRemainingDays[]> {
  const tokens = await prisma.token.findMany({
    orderBy: { createdAt: 'desc' },
    skip,
    ...(limit > 0 ? { take: limit } : {}),
  });

  return tokens.map((token) => ({
    ...token,
    redemptionDetails: getRedemptionDetails(token),
    remainingDays: calculateRemainingDays(token.expiresAt),
  }));
}

export async function getTotalTokens(): Promise<number> {
  return prisma.token.count();
}

/**
 * Exporta la información de los tokens a un archivo Excel (formato .xlsx).
 */
export async function exportToExcel(): Promise<Buffer> {
  const tokens = await prisma.token.findMany({ orderBy: { createdAt: 'desc' } });

  // Mapear cada token a un objeto con el formato deseado
  const data = tokens.map((token) => {
    const remainingDays = calculateRemainingDays(token.expiresAt);
    const isActive = token.status === TokenStatus.active && remainingDays > 0;

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
      Estado_Licencia: token.status,
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
    { wch: 15 }, // Estado_Licencia
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tokens');

  // Escribir el libro en un Buffer con formato 'xlsx'
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buffer;
}

/**
 * Valida y canjea (redime) un token de forma atómica.
 * Usa updateMany condicional para evitar condiciones de carrera:
 * solo actualiza si token existe, no está redimido y no ha expirado.
 */
export async function validateAndRedeemToken(
  token: string,
  machineId: string,
  clientInfo: ClientInfo,
): Promise<ValidationResult> {
  const redeemedAt = new Date();
  const newExpiresAt = getFirstDayOfNextMonthAfterMonths(redeemedAt, 1);

  // Operación atómica: solo actualiza si cumple TODAS las condiciones
  const result = await prisma.token.updateMany({
    where: {
      token,
      isRedeemed: false,
      expiresAt: { gte: redeemedAt },
      status: TokenStatus.active,
    },
    data: {
      isRedeemed: true,
      redeemedAt,
      machineId,
      expiresAt: newExpiresAt,
      redemptionIp: clientInfo.ip,
      redemptionDeviceInfo: clientInfo.deviceInfo || 'No proporcionado',
      redemptionTimestamp: redeemedAt,
    },
  });

  if (result.count === 1) {
    return {
      success: true,
      valid: true,
      message: 'Token validado y activado correctamente',
      expiresAt: newExpiresAt,
    };
  }

  // Si count === 0, determinar la razón exacta del fallo
  const tokenRecord = await prisma.token.findUnique({ where: { token } });

  if (!tokenRecord) {
    return {
      success: false,
      valid: false,
      message: 'Token no encontrado',
      errorCode: 'TOKEN_NOT_FOUND',
    };
  }

  if (tokenRecord.status !== TokenStatus.active) {
    const statusErrorMap: Record<string, string> = {
      suspended: 'TOKEN_SUSPENDED',
      cancelled: 'TOKEN_CANCELLED',
      expired: 'TOKEN_EXPIRED',
    };
    return {
      success: false,
      valid: false,
      message: `Token ${tokenRecord.status}`,
      errorCode: statusErrorMap[tokenRecord.status] || 'TOKEN_INACTIVE',
    };
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

  return { success: false, valid: false, message: 'Token expirado', errorCode: 'TOKEN_EXPIRED' };
}

/**
 * Obtener tokens expirados.
 */
export async function getExpiredTokens(): Promise<Token[]> {
  const now = new Date();
  return prisma.token.findMany({
    where: {
      expiresAt: { lt: now },
      status: TokenStatus.active,
    },
    orderBy: { expiresAt: 'asc' },
  });
}

// ---------------------------------------------------------------------------
// Filtrado genérico de tokens
// ---------------------------------------------------------------------------

export type TokenFilter =
  | 'active'
  | 'expiring_soon'
  | 'expired'
  | 'suspended'
  | 'cancelled'
  | 'all';

export async function getTokensByFilter(filter: TokenFilter): Promise<TokenWithRemainingDays[]> {
  const now = new Date();
  const soonDate = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);

  let tokens: Token[];

  switch (filter) {
    case 'active':
      tokens = await prisma.token.findMany({
        where: { status: TokenStatus.active, expiresAt: { gt: soonDate } },
        orderBy: { expiresAt: 'asc' },
      });
      break;
    case 'expiring_soon':
      tokens = await prisma.token.findMany({
        where: { status: TokenStatus.active, expiresAt: { gt: now, lte: soonDate } },
        orderBy: { expiresAt: 'asc' },
      });
      break;
    case 'expired':
      tokens = await prisma.token.findMany({
        where: { status: TokenStatus.active, expiresAt: { lt: now } },
        orderBy: { expiresAt: 'asc' },
      });
      break;
    case 'suspended':
      tokens = await prisma.token.findMany({
        where: { status: TokenStatus.suspended },
        orderBy: { createdAt: 'desc' },
      });
      break;
    case 'cancelled':
      tokens = await prisma.token.findMany({
        where: { status: TokenStatus.cancelled },
        orderBy: { createdAt: 'desc' },
      });
      break;
    case 'all':
      tokens = await prisma.token.findMany({ orderBy: { createdAt: 'desc' } });
      break;
  }

  return tokens.map((token) => ({
    ...token,
    redemptionDetails: getRedemptionDetails(token),
    remainingDays: calculateRemainingDays(token.expiresAt),
  }));
}

/**
 * Eliminar un token por su valor.
 */
export async function deleteToken(tokenValue: string): Promise<boolean> {
  try {
    await prisma.token.delete({ where: { token: tokenValue } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Actualiza el status administrativo de un token.
 */
export async function updateTokenStatus(
  tokenValue: string,
  status: TokenStatus,
  reason?: string,
): Promise<Token> {
  return prisma.token.update({
    where: { token: tokenValue },
    data: {
      status,
      statusReason: reason ?? null,
    },
  });
}

/**
 * Renovar token por meses.
 */
export async function renewToken(tokenId: string, months: number): Promise<Token> {
  const token = await prisma.token.findUnique({ where: { token: tokenId } });
  if (!token) {
    throw new Error('Token no encontrado');
  }

  // Siempre usar la fecha actual como base y establecer al primer día del mes siguiente
  const now = new Date();
  const newExpiryDate = getFirstDayOfNextMonthAfterMonths(now, months);

  return prisma.token.update({
    where: { token: tokenId },
    data: {
      expiresAt: newExpiryDate,
      status: TokenStatus.active,
      statusReason: null,
    },
  });
}
