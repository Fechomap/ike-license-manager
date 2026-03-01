// src/controllers/apiController.ts
import type { Request, Response } from 'express';

import config from '../config/config';
import { generateToken as generateJwt } from '../services/authService';
import * as tokenService from '../services/tokenService';

// ---------------------------------------------------------------------------
// Helpers de validacion y logging
// ---------------------------------------------------------------------------

const TOKEN_HEX_PATTERN = /^[a-f0-9]{32}$/;

function isValidTokenFormat(token: string): boolean {
  return TOKEN_HEX_PATTERN.test(token);
}

const MACHINE_ID_PATTERN = /^[A-Za-z0-9._:\-]{8,128}$/;

function isValidMachineId(machineId: string): boolean {
  return MACHINE_ID_PATTERN.test(machineId);
}

function maskToken(token: string): string {
  if (token.length <= 6) {
    return token;
  }
  return token.slice(0, 6) + '***';
}

interface StructuredLog {
  event: string;
  token?: string;
  success?: boolean;
  errorCode?: string;
  ip?: string;
  timestamp: string;
}

function logStructured(data: StructuredLog): void {
  console.log(JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function validateToken(req: Request, res: Response): Promise<void> {
  try {
    const { token, machineId, deviceInfo } = req.body as {
      token?: string;
      machineId?: string;
      deviceInfo?: string;
    };
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    if (!token || !machineId) {
      logStructured({
        event: 'token_validation',
        token: token ? maskToken(token) : undefined,
        success: false,
        errorCode: 'MISSING_PARAMS',
        ip: clientIp,
        timestamp: new Date().toISOString(),
      });
      res.status(400).json({
        success: false,
        valid: false,
        message: 'Token y machineId son requeridos',
        errorCode: 'MISSING_PARAMS',
      });
      return;
    }

    if (!isValidTokenFormat(token)) {
      logStructured({
        event: 'token_validation',
        token: maskToken(token),
        success: false,
        errorCode: 'INVALID_FORMAT',
        ip: clientIp,
        timestamp: new Date().toISOString(),
      });
      res.status(400).json({
        success: false,
        valid: false,
        message: 'Formato de token invalido',
        errorCode: 'INVALID_FORMAT',
      });
      return;
    }

    if (!isValidMachineId(machineId)) {
      logStructured({
        event: 'token_validation',
        token: maskToken(token),
        success: false,
        errorCode: 'INVALID_FORMAT',
        ip: clientIp,
        timestamp: new Date().toISOString(),
      });
      res.status(400).json({
        success: false,
        valid: false,
        message: 'Formato de machineId invalido (alfanumerico, 8-128 caracteres)',
        errorCode: 'INVALID_FORMAT',
      });
      return;
    }

    const validationResult = await tokenService.validateAndRedeemToken(token, machineId, {
      ip: clientIp,
      deviceInfo: deviceInfo || 'No proporcionado',
    });

    logStructured({
      event: 'token_validation',
      token: maskToken(token),
      success: validationResult.success,
      errorCode: validationResult.success ? undefined : validationResult.errorCode,
      ip: clientIp,
      timestamp: new Date().toISOString(),
    });

    res.json(validationResult);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logStructured({
      event: 'token_validation',
      success: false,
      errorCode: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
    console.error('Error validando token:', message);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Error al validar el token',
      errorCode: 'INTERNAL_ERROR',
    });
  }
}

export async function checkTokenValidity(req: Request, res: Response): Promise<void> {
  try {
    const tokenParam = req.params.token;
    const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

    if (!token || !isValidTokenFormat(token)) {
      logStructured({
        event: 'token_check_validity',
        token: token ? maskToken(token) : undefined,
        success: false,
        errorCode: 'INVALID_FORMAT',
        timestamp: new Date().toISOString(),
      });
      res.status(400).json({
        valid: false,
        message: 'Formato de token invalido',
      });
      return;
    }

    const result = await tokenService.checkTokenStatus(token);

    logStructured({
      event: 'token_check_validity',
      token: maskToken(token),
      success: result.valid,
      timestamp: new Date().toISOString(),
    });

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logStructured({
      event: 'token_check_validity',
      success: false,
      errorCode: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
    console.error('Error verificando token:', message);
    res.status(500).json({
      valid: false,
      message: 'Error al verificar el token',
    });
  }
}

export async function getAllTokens(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const tokens = await tokenService.getAllTokens(skip, limit);
    const totalTokens = await tokenService.getTotalTokens();

    const response = {
      tokens,
      currentPage: page,
      totalPages: Math.ceil(totalTokens / limit),
    };

    res.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logStructured({
      event: 'get_all_tokens',
      success: false,
      errorCode: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
    console.error('Error obteniendo tokens:', message);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tokens',
    });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { adminKey } = req.body as { adminKey?: string };

    // Usar ADMIN_API_KEY, con fallback temporal a ADMIN_CHAT_ID (deprecated)
    const validKey = config.adminApiKey || config.adminChatId;

    if (!adminKey || !validKey || adminKey !== validKey) {
      logStructured({
        event: 'login_attempt',
        success: false,
        errorCode: 'INVALID_CREDENTIALS',
        timestamp: new Date().toISOString(),
      });
      res.status(403).json({ success: false, message: 'Credenciales invalidas' });
      return;
    }

    if (!config.adminApiKey && config.adminChatId) {
      console.warn('Using ADMIN_CHAT_ID for login (deprecated). Configure ADMIN_API_KEY.');
    }

    const token = generateJwt({ role: 'admin' }, '24h');

    logStructured({
      event: 'login_attempt',
      success: true,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, token });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logStructured({
      event: 'login_attempt',
      success: false,
      errorCode: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
    console.error('Error en login:', message);
    res.status(500).json({ success: false, message: 'Error al generar token' });
  }
}
