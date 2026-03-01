// src/controllers/apiController.ts
import type { Request, Response } from 'express';

import config from '../config/config';
import { generateToken as generateJwt } from '../services/authService';
import * as tokenService from '../services/tokenService';

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
    const clientIp = req.ip || req.socket.remoteAddress;

    if (!token || !machineId) {
      res.status(400).json({
        success: false,
        message: 'Token y machineId son requeridos',
      });
      return;
    }

    const validationResult = await tokenService.validateAndRedeemToken(token, machineId, {
      ip: clientIp || 'unknown',
      deviceInfo: deviceInfo || 'No proporcionado',
    });

    res.json(validationResult);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error validando token:', message);
    res.status(500).json({
      success: false,
      message: 'Error al validar el token',
      error: message,
    });
  }
}

export async function checkTokenValidity(req: Request, res: Response): Promise<void> {
  try {
    const tokenParam = req.params.token;
    const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
    if (!token) {
      res.json(false);
      return;
    }

    const isValid = await tokenService.isTokenValid(token);
    res.json(isValid);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error: unknown) {
    res.json(false);
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
      res.status(401).json({ success: false, message: 'Credenciales invalidas' });
      return;
    }

    if (!config.adminApiKey && config.adminChatId) {
      console.warn('⚠️ Usando ADMIN_CHAT_ID para login (deprecated). Configure ADMIN_API_KEY.');
    }

    const token = generateJwt({ role: 'admin' }, '24h');
    res.json({ success: true, token });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error en login:', message);
    res.status(500).json({ success: false, message: 'Error al generar token' });
  }
}
