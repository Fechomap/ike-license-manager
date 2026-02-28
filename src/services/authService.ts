// src/services/authService.ts
import type { JwtPayload, SignOptions } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';

import config from '../config/config';

/**
 * Genera un token JWT usando los datos del usuario.
 *
 * @param payload - Los datos que deseas incluir en el token.
 * @param expiresIn - Tiempo de expiración del token (opcional, default '1h').
 * @returns Token JWT firmado.
 */
export function generateToken(payload: object, expiresIn: string = '1h'): string {
  const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, config.jwtSecret!, options);
}

/**
 * Verifica y decodifica un token JWT.
 *
 * @param token - El token JWT a verificar.
 * @returns Los datos decodificados si el token es válido.
 */
export function verifyToken(token: string): string | JwtPayload {
  try {
    return jwt.verify(token, config.jwtSecret!);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error: unknown) {
    throw new Error('Token inválido o expirado');
  }
}
