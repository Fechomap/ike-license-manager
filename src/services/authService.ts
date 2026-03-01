// src/services/authService.ts
import type { JwtPayload, SignOptions } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';

import config from '../config/config';

/**
 * Genera un token JWT usando los datos del usuario.
 *
 * @param payload - Los datos que deseas incluir en el token.
 * @param expiresIn - Tiempo de expiracion del token (opcional, default '24h').
 * @returns Token JWT firmado.
 */
export function generateToken(payload: object, expiresIn = '24h'): string {
  if (!config.jwtSecret) {
    throw new Error('JWT_SECRET no configurado');
  }
  const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, config.jwtSecret, options);
}

/**
 * Verifica y decodifica un token JWT.
 *
 * @param token - El token JWT a verificar.
 * @returns Los datos decodificados si el token es valido.
 */
export function verifyToken(token: string): string | JwtPayload {
  if (!config.jwtSecret) {
    throw new Error('JWT_SECRET no configurado');
  }
  try {
    return jwt.verify(token, config.jwtSecret);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error: unknown) {
    throw new Error('Token invalido o expirado');
  }
}
