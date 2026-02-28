// src/controllers/apiController.ts
import type { Request, Response } from 'express';

import config from '../config/config';
import telegramService from '../services/telegramService';
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

    await sendTokensToTelegram(tokens);

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

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

interface TokenSummary {
  token: string;
  name: string;
  email: string;
  isRedeemed: boolean;
  remainingDays: number;
}

/**
 * Envia la lista de tokens al chat de Telegram configurado.
 * Si el mensaje sobrepasa los 4096 caracteres de Telegram,
 * se dividira automaticamente en chunks para evitar el error "message is too long".
 */
async function sendTokensToTelegram(tokens: TokenSummary[]): Promise<void> {
  if (!config.adminChatId) {
    console.warn('ADMIN_CHAT_ID no configurado, omitiendo envio a Telegram');
    return;
  }

  let message = '\u{1f4cb} *Lista de tokens:*\n\n';
  for (const token of tokens) {
    message +=
      `\u{1f511} *Token:* ${token.token}\n` +
      `\u{1f464} *Usuario:* ${token.name}\n` +
      `\u{1f4e7} *Email:* ${token.email}\n` +
      `\u{1f4c5} *Estado:* ${token.isRedeemed ? 'Canjeado' : 'No canjeado'}\n` +
      `\u{23f0} *Dias restantes:* ${token.remainingDays}\n\n`;
  }

  const chunkSize = 4000;
  let startIndex = 0;

  while (startIndex < message.length) {
    const messageChunk = message.slice(startIndex, startIndex + chunkSize);
    await telegramService.bot.sendMessage(config.adminChatId, messageChunk, {
      parse_mode: 'Markdown',
    });
    startIndex += chunkSize;
  }
}
