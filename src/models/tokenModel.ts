import type { Token } from '../generated/prisma/client';

// Re-export del tipo generado por Prisma
export type { Token };

// Alias de compatibilidad para el resto del codigo
export type ITokenDocument = Token;

export interface IToken {
  token: string;
  email: string;
  name: string;
  phone: string;
  createdAt: Date;
  expiresAt: Date;
  isRedeemed: boolean;
  redeemedAt?: Date | null;
  machineId?: string | null;
  redemptionDetails?: IRedemptionDetails;
}

export interface IRedemptionDetails {
  ip?: string;
  deviceInfo?: string;
  timestamp?: Date;
}

// Helper para reconstruir redemptionDetails desde columnas planas
export function getRedemptionDetails(token: Token): IRedemptionDetails | undefined {
  if (!token.redemptionIp && !token.redemptionDeviceInfo && !token.redemptionTimestamp) {
    return undefined;
  }
  return {
    ip: token.redemptionIp ?? undefined,
    deviceInfo: token.redemptionDeviceInfo ?? undefined,
    timestamp: token.redemptionTimestamp ?? undefined,
  };
}
