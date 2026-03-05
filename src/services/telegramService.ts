// src/services/telegramService.ts
import TelegramBot from 'node-telegram-bot-api';

import config from '../config/config';
import { TokenStatus } from '../generated/prisma/enums';

import { sendWelcomeEmail } from './emailService';
import * as tokenService from './tokenService';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface UserData {
  email: string;
  name: string;
  phone: string;
}

interface UserState {
  step: 'email' | 'name' | 'phone' | 'payment_amount' | 'payment_date';
  data: Partial<UserData>;
  paymentToken?: string;
  paymentAmount?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  active: '🟢 Activo',
  expired: '🔴 Expirado',
  suspended: '🟡 Suspendido',
  cancelled: '❌ Cancelado',
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

// ---------------------------------------------------------------------------
// Teclado persistente
// ---------------------------------------------------------------------------

const MAIN_KEYBOARD: TelegramBot.SendMessageOptions['reply_markup'] = {
  keyboard: [
    [{ text: '🎫 Generar Token' }, { text: '📋 Listar Tokens' }],
    [{ text: '📊 Exportar Excel' }],
  ],
  resize_keyboard: true,
  one_time_keyboard: false,
  is_persistent: true,
};

const FILTER_LABELS: Record<string, string> = {
  active: '🟢 Activos',
  expiring_soon: '⏳ Por Caducar',
  expired: '🔴 Expirados',
  suspended: '🟡 Suspendidos',
  cancelled: '❌ Cancelados',
  all: '📋 Todos',
};

// ---------------------------------------------------------------------------
// Clase TelegramService
// ---------------------------------------------------------------------------

class TelegramService {
  bot: TelegramBot;
  userStates: Map<number, UserState>;

  constructor() {
    if (!config.telegramToken) {
      throw new Error('TELEGRAM_TOKEN es requerido para iniciar el servicio de Telegram');
    }

    if (config.isProduction) {
      // Modo Webhook para Railway
      this.bot = new TelegramBot(config.telegramToken);
      void this.setupWebhook();
    } else {
      // Modo Polling para desarrollo local
      this.bot = new TelegramBot(config.telegramToken, { polling: true });
    }
    this.userStates = new Map();
    this.initializeCommands();
    void this.registerMenuCommands();
  }

  async registerMenuCommands(): Promise<void> {
    try {
      await this.bot.setMyCommands([
        { command: 'start', description: '🏠 Mostrar menú principal' },
        { command: 'generar_token', description: '🎫 Generar un nuevo token' },
        { command: 'listar_tokens', description: '📋 Listar tokens (con filtros)' },
        { command: 'exportar_excel', description: '📊 Exportar base de datos a Excel' },
      ]);
    } catch (error: unknown) {
      console.error(
        '❌ Error al registrar comandos del menú:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  async setupWebhook(): Promise<void> {
    if (!config.railwayPublicDomain) {
      console.error('❌ RAILWAY_PUBLIC_DOMAIN no está definido');
      return;
    }

    const url = `https://${config.railwayPublicDomain}/api/telegram-webhook`;
    try {
      await this.bot.setWebHook(url);
      console.log(`✅ Webhook configurado en: ${url}`);
    } catch (error: unknown) {
      console.error(
        '❌ Error al configurar webhook:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  initializeCommands(): void {
    // Comandos slash (fallback)
    this.bot.onText(/\/start/, (msg: TelegramBot.Message) => {
      void this.handleStart(msg);
    });
    this.bot.onText(/\/generar_token/, (msg: TelegramBot.Message) => {
      void this.startTokenGeneration(msg);
    });
    this.bot.onText(/\/listar_tokens/, (msg: TelegramBot.Message) => {
      void this.handleListTokens(msg);
    });
    this.bot.onText(/\/tokens_caducando/, (msg: TelegramBot.Message) => {
      void this.handleTokensExpiringSoon(msg);
    });
    this.bot.onText(/\/tokens_expirados/, (msg: TelegramBot.Message) => {
      void this.handleExpiredTokens(msg);
    });
    this.bot.onText(/\/exportar_excel/, (msg: TelegramBot.Message) => {
      void this.handleExportExcel(msg);
    });

    // Botones del teclado persistente
    this.bot.onText(/🎫 Generar Token/, (msg: TelegramBot.Message) => {
      void this.startTokenGeneration(msg);
    });
    this.bot.onText(/📋 Listar Tokens/, (msg: TelegramBot.Message) => {
      void this.handleListTokens(msg);
    });
    this.bot.onText(/📊 Exportar Excel/, (msg: TelegramBot.Message) => {
      void this.handleExportExcel(msg);
    });

    // Manejador de callbacks para los botones inline
    this.bot.on('callback_query', (query: TelegramBot.CallbackQuery) => {
      void this.handleCallbackQuery(query);
    });

    this.bot.on('message', (msg: TelegramBot.Message) => {
      void this.handleMessage(msg);
    });
  }

  async handleListTokens(msg: TelegramBot.Message): Promise<void> {
    const filterKeys = Object.keys(FILTER_LABELS) as tokenService.TokenFilter[];
    const buttons: TelegramBot.InlineKeyboardButton[][] = [];

    // 2 filtros por fila
    for (let i = 0; i < filterKeys.length; i += 2) {
      const row: TelegramBot.InlineKeyboardButton[] = filterKeys.slice(i, i + 2).map((key) => ({
        text: FILTER_LABELS[key] ?? key,
        callback_data: `filter:${key}`,
      }));
      buttons.push(row);
    }

    await this.bot.sendMessage(msg.chat.id, '📋 Selecciona un filtro para ver tokens:', {
      reply_markup: { inline_keyboard: buttons },
    });
  }

  async handleFilteredTokenList(
    chatId: number,
    messageId: number,
    filter: tokenService.TokenFilter,
  ): Promise<void> {
    try {
      const label = FILTER_LABELS[filter] ?? filter;

      await this.bot.editMessageText(`⏳ Buscando tokens: ${label}...`, {
        chat_id: chatId,
        message_id: messageId,
      });

      const tokens = await tokenService.getTokensByFilter(filter);

      if (tokens.length === 0) {
        await this.bot.editMessageText(`${label} — No se encontraron tokens.`, {
          chat_id: chatId,
          message_id: messageId,
        });
        return;
      }

      await this.bot.editMessageText(
        `${label} — ${tokens.length} token${tokens.length === 1 ? '' : 's'}:`,
        { chat_id: chatId, message_id: messageId },
      );

      for (const token of tokens) {
        const redeemStatus = token.isRedeemed ? '✅ Canjeado' : '⏳ No canjeado';
        const days = token.remainingDays || 0;

        const tokenMessage =
          `🔑 Token: ${token.token}\n` +
          `👤 Usuario: ${token.name || 'N/A'}\n` +
          `📧 Email: ${token.email || 'N/A'}\n` +
          `📅 Canje: ${redeemStatus}\n` +
          `🏷️ Licencia: ${statusLabel(token.status)}\n` +
          `⏰ Días restantes: ${days}`;

        const buttons: TelegramBot.InlineKeyboardButton[][] = [];

        if (token.status === TokenStatus.active && token.remainingDays > 0) {
          buttons.push([{ text: '💰 Registrar Pago', callback_data: `pay:${token.token}` }]);
          if (token.isRedeemed) {
            buttons.push([{ text: '🔄 Renovar Token', callback_data: `renew:${token.token}` }]);
          }
          buttons.push([
            { text: '🚫 Suspender', callback_data: `suspend:${token.token}` },
            { text: '❌ Cancelar', callback_data: `cancel:${token.token}` },
          ]);
        } else if (token.status === TokenStatus.active && token.remainingDays <= 0) {
          // Expirado pero aún con status active
          buttons.push([
            { text: '💰 Registrar Pago', callback_data: `pay:${token.token}` },
            { text: '🗑️ Borrar', callback_data: `delete:${token.token}` },
          ]);
        } else {
          // Suspended / Cancelled
          buttons.push([
            { text: '✅ Reactivar', callback_data: `reactivate:${token.token}` },
            { text: '🗑️ Borrar', callback_data: `delete:${token.token}` },
          ]);
        }

        await this.bot.sendMessage(chatId, tokenMessage, {
          reply_markup: { inline_keyboard: buttons },
        });

        await this.sleep(300);
      }
    } catch (error: unknown) {
      console.error('Error al filtrar tokens:', error instanceof Error ? error.message : error);
      await this.bot.sendMessage(chatId, '❌ Error al obtener la lista de tokens');
    }
  }

  async handleTokensExpiringSoon(msg: TelegramBot.Message): Promise<void> {
    try {
      const tokens = await tokenService.getTokensExpiringSoon(7);
      if (tokens.length === 0) {
        await this.bot.sendMessage(msg.chat.id, '✨ ¡No hay tokens próximos a expirar!');
        return;
      }

      let message = '⚠️ Tokens próximos a expirar:\n\n';
      tokens.forEach((token) => {
        message += `🔑 Token: ${token.token}\n`;
        message += `👤 Usuario: ${token.name}\n`;
        message += `🏷️ Licencia: ${statusLabel(token.status)}\n`;
        message += `📅 Expira: ${token.expiresAt.toLocaleDateString()}\n\n`;
      });

      await this.bot.sendMessage(msg.chat.id, message);
    } catch (error: unknown) {
      console.error(
        'Error al obtener tokens por expirar:',
        error instanceof Error ? error.message : error,
      );
      await this.bot.sendMessage(msg.chat.id, '❌ Error al consultar tokens próximos a expirar');
    }
  }

  async handleExpiredTokens(msg: TelegramBot.Message): Promise<void> {
    try {
      const tokens = await tokenService.getExpiredTokens();

      if (tokens.length === 0) {
        await this.bot.sendMessage(msg.chat.id, '✨ No hay tokens expirados en este momento.');
        return;
      }

      await this.bot.sendMessage(
        msg.chat.id,
        `📋 Encontrados ${tokens.length} tokens expirados. Procesando lista...`,
      );

      for (const token of tokens) {
        const message =
          `🔑 Token: ${token.token}\n` +
          `👤 Usuario: ${token.name}\n` +
          `📧 Email: ${token.email}\n` +
          `📱 Teléfono: ${token.phone}\n` +
          `🏷️ Licencia: ${statusLabel(token.status)}\n` +
          `📅 Fecha de expiración: ${token.expiresAt.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}\n` +
          `${token.isRedeemed ? '✅ Token redimido' : '❌ Token no redimido'}`;

        const buttons: TelegramBot.InlineKeyboardButton[][] = [
          [
            { text: '💰 Registrar Pago', callback_data: `pay:${token.token}` },
            { text: '🗑️ Borrar', callback_data: `delete:${token.token}` },
          ],
        ];
        if (token.status !== TokenStatus.active) {
          buttons.push([{ text: '✅ Reactivar', callback_data: `reactivate:${token.token}` }]);
        }

        await this.bot.sendMessage(msg.chat.id, message, {
          reply_markup: { inline_keyboard: buttons },
        });

        await this.sleep(500);
      }

      await this.bot.sendMessage(msg.chat.id, '✅ Lista de tokens expirados completada');
    } catch (error: unknown) {
      console.error(
        'Error al listar tokens expirados:',
        error instanceof Error ? error.message : error,
      );
      await this.bot.sendMessage(msg.chat.id, '❌ Error al obtener la lista de tokens expirados');
    }
  }

  async handleExportExcel(msg: TelegramBot.Message): Promise<void> {
    try {
      await this.bot.sendMessage(msg.chat.id, '⏳ Generando archivo Excel...');
      const buffer = await tokenService.exportToExcel();
      const filename = `tokens_${new Date().toISOString().slice(0, 10)}.xlsx`;
      await this.bot.sendDocument(
        msg.chat.id,
        buffer,
        { caption: '📊 Base de datos de tokens exportada' },
        {
          filename,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      );
    } catch (error: unknown) {
      console.error('Error al exportar Excel:', error instanceof Error ? error.message : error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error al generar el archivo Excel');
    }
  }

  async handleCallbackQuery(query: TelegramBot.CallbackQuery): Promise<void> {
    const data = query.data;
    if (!data) {
      return;
    }

    const parts = data.split(':');
    const action = parts[0];
    const tokenId = parts[1];

    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;

    if (!chatId || !messageId) {
      return;
    }

    try {
      switch (action) {
        case 'filter': {
          if (!tokenId) {
            break;
          }
          const validFilters: tokenService.TokenFilter[] = [
            'active',
            'expiring_soon',
            'expired',
            'suspended',
            'cancelled',
            'all',
          ];
          const filter = tokenId as tokenService.TokenFilter;
          if (validFilters.includes(filter)) {
            await this.handleFilteredTokenList(chatId, messageId, filter);
          }
          break;
        }

        case 'pay': {
          if (!tokenId) {
            break;
          }
          this.userStates.set(chatId, {
            step: 'payment_amount',
            data: {},
            paymentToken: tokenId,
          });
          await this.bot.sendMessage(
            chatId,
            `💰 *Registro de pago*\n\n` +
              `Token: \`${tokenId}\`\n` +
              `Precio por mes: $${tokenService.PRICE_PER_MONTH_MXN.toLocaleString()} MXN\n\n` +
              `Ingresa el monto del pago (múltiplo de $${tokenService.PRICE_PER_MONTH_MXN.toLocaleString()}):`,
            { parse_mode: 'Markdown' },
          );
          break;
        }

        case 'delete': {
          if (!tokenId) {
            break;
          }
          const deleted = await tokenService.deleteToken(tokenId);
          if (deleted) {
            await this.bot.editMessageText('🗑️ Token eliminado permanentemente.', {
              chat_id: chatId,
              message_id: messageId,
            });
          } else {
            await this.bot.editMessageText('⚠️ Token no encontrado o ya fue eliminado.', {
              chat_id: chatId,
              message_id: messageId,
            });
          }
          break;
        }

        case 'suspend': {
          if (!tokenId) {
            break;
          }
          await tokenService.updateTokenStatus(
            tokenId,
            TokenStatus.suspended,
            'Suspendido por admin',
          );
          await this.bot.editMessageText('🚫 Token suspendido.', {
            chat_id: chatId,
            message_id: messageId,
          });
          break;
        }

        case 'cancel': {
          if (!tokenId) {
            break;
          }
          await tokenService.updateTokenStatus(
            tokenId,
            TokenStatus.cancelled,
            'Cancelado por admin',
          );
          await this.bot.editMessageText('❌ Token cancelado.', {
            chat_id: chatId,
            message_id: messageId,
          });
          break;
        }

        case 'reactivate': {
          if (!tokenId) {
            break;
          }
          await tokenService.updateTokenStatus(tokenId, TokenStatus.active);
          await this.bot.editMessageText('✅ Token reactivado.', {
            chat_id: chatId,
            message_id: messageId,
          });
          break;
        }

        case 'renew': {
          if (!tokenId) {
            break;
          }
          const newToken = await tokenService.renewToken(tokenId);
          if (newToken) {
            await this.bot.editMessageText(
              `🔄 *Token renovado*\n\n` +
                `Token anterior: \`${tokenId}\`\n` +
                `Nuevo token: \`${newToken}\`\n\n` +
                `📋 Envía el nuevo token al usuario para que lo ingrese en la app.`,
              {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
              },
            );
          } else {
            await this.bot.editMessageText('⚠️ Token no encontrado.', {
              chat_id: chatId,
              message_id: messageId,
            });
          }
          break;
        }
      }
    } catch (error: unknown) {
      console.error('Error en callback handler:', error instanceof Error ? error.message : error);
      await this.bot.sendMessage(chatId, '❌ Error al procesar la acción');
    }
  }

  // Función auxiliar para crear un retraso
  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async handleStart(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    await this.bot.sendMessage(
      chatId,
      '👋 ¡Bienvenido al gestor de licencias!\nUsa los botones para comenzar.',
      { reply_markup: MAIN_KEYBOARD },
    );
  }

  async startTokenGeneration(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    this.userStates.set(chatId, {
      step: 'email',
      data: {},
    });

    await this.bot.sendMessage(chatId, '📧 Por favor, ingresa el correo electrónico del usuario:');
  }

  async handleMessage(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userState = this.userStates.get(chatId);

    const text = msg.text;
    if (!text) {
      return;
    }

    // Si no hay flujo activo, ignorar comandos/botones (ya tienen su handler)
    // y para cualquier otro texto, reenviar el teclado
    if (!userState) {
      const isHandled =
        text.startsWith('/') ||
        text.includes('🎫 Generar Token') ||
        text.includes('📋 Listar Tokens') ||
        text.includes('📊 Exportar Excel');
      if (!isHandled) {
        await this.bot.sendMessage(chatId, '👋 Usa los botones del menú para continuar.', {
          reply_markup: MAIN_KEYBOARD,
        });
      }
      return;
    }

    switch (userState.step) {
      case 'email':
        if (this.validateEmail(text)) {
          userState.data.email = text;
          userState.step = 'name';
          await this.bot.sendMessage(chatId, '👤 Por favor, ingresa el nombre completo:');
        } else {
          this.userStates.delete(chatId);
          await this.bot.sendMessage(
            chatId,
            '❌ Email inválido. Presiona 🎫 Generar Token para intentar de nuevo.',
            { reply_markup: MAIN_KEYBOARD },
          );
        }
        break;

      case 'name':
        if (text.length >= 3) {
          userState.data.name = text;
          userState.step = 'phone';
          await this.bot.sendMessage(
            chatId,
            '📱 Por favor, ingresa el número de teléfono (solo números):',
          );
        } else {
          this.userStates.delete(chatId);
          await this.bot.sendMessage(
            chatId,
            '❌ Nombre demasiado corto. Presiona 🎫 Generar Token para intentar de nuevo.',
            { reply_markup: MAIN_KEYBOARD },
          );
        }
        break;

      case 'phone':
        if (this.validatePhone(text)) {
          userState.data.phone = text.replace(/\D/g, '');
          await this.generateAndSendToken(chatId, userState.data as UserData);
          this.userStates.delete(chatId);
        } else {
          this.userStates.delete(chatId);
          await this.bot.sendMessage(
            chatId,
            '❌ Número de teléfono inválido. Presiona 🎫 Generar Token para intentar de nuevo.',
            { reply_markup: MAIN_KEYBOARD },
          );
        }
        break;

      case 'payment_amount': {
        const amount = parseInt(text.replace(/[,$.\s]/g, ''), 10);
        if (isNaN(amount) || amount <= 0 || amount % tokenService.PRICE_PER_MONTH_MXN !== 0) {
          this.userStates.delete(chatId);
          const price = tokenService.PRICE_PER_MONTH_MXN.toLocaleString();
          await this.bot.sendMessage(
            chatId,
            `❌ El monto debe ser un múltiplo positivo de $${price} MXN.\n` +
              `Ejemplos: $${price}, $${(tokenService.PRICE_PER_MONTH_MXN * 2).toLocaleString()}, $${(tokenService.PRICE_PER_MONTH_MXN * 3).toLocaleString()}...`,
            { reply_markup: MAIN_KEYBOARD },
          );
          break;
        }
        const months = amount / tokenService.PRICE_PER_MONTH_MXN;
        userState.paymentAmount = amount;
        userState.step = 'payment_date';
        await this.bot.sendMessage(
          chatId,
          `💵 Monto: $${amount.toLocaleString()} MXN (${months} ${months === 1 ? 'mes' : 'meses'})\n\n` +
            `📅 Ingresa la fecha del pago:\n` +
            `• Formato: DD/MM/AAAA (ej: 01/03/2026)\n` +
            `• Escribe "hoy" para usar la fecha actual`,
        );
        break;
      }

      case 'payment_date': {
        let paidAt: Date;
        const trimmed = text.trim().toLowerCase();

        if (trimmed === 'hoy') {
          paidAt = new Date();
        } else {
          const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (!match) {
            this.userStates.delete(chatId);
            await this.bot.sendMessage(
              chatId,
              '❌ Formato de fecha inválido. Usa DD/MM/AAAA o "hoy".',
              { reply_markup: MAIN_KEYBOARD },
            );
            break;
          }
          const day = match[1] as string;
          const month = match[2] as string;
          const year = match[3] as string;
          paidAt = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
          if (isNaN(paidAt.getTime())) {
            this.userStates.delete(chatId);
            await this.bot.sendMessage(chatId, '❌ Fecha inválida.', {
              reply_markup: MAIN_KEYBOARD,
            });
            break;
          }
        }

        const payToken = userState.paymentToken ?? '';
        const payAmount = userState.paymentAmount ?? 0;

        try {
          const result = await tokenService.registerPayment(payToken, payAmount, paidAt);

          const dateStr = paidAt.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });
          const expiryStr = result.newExpiresAt.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });

          await this.bot.sendMessage(
            chatId,
            `✅ *Pago registrado exitosamente*\n\n` +
              `🔑 Token: \`${payToken}\`\n` +
              `💵 Monto: $${payAmount.toLocaleString()} MXN\n` +
              `📅 Fecha de pago: ${dateStr}\n` +
              `🗓️ Meses: ${result.months}\n` +
              `📆 Nueva expiración: ${expiryStr}`,
            { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD },
          );
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Error desconocido';
          await this.bot.sendMessage(chatId, `❌ Error al registrar pago: ${msg}`, {
            reply_markup: MAIN_KEYBOARD,
          });
        }

        this.userStates.delete(chatId);
        break;
      }
    }
  }

  async generateAndSendToken(chatId: number, userData: UserData): Promise<void> {
    try {
      const result = await tokenService.createToken(userData);

      // Mensaje para Telegram
      const telegramMessage =
        '🎉 ¡Token generado exitosamente!\n\n' +
        `🔑 Token: ${result.token}\n` +
        `👤 Usuario: ${userData.name}\n` +
        `📧 Email: ${userData.email}\n` +
        `📱 Teléfono: ${userData.phone}\n` +
        `📅 Válido hasta: ${result.expiresAt.toLocaleDateString()}\n\n` +
        '⚠️ IMPORTANTE:\n' +
        '• Este token solo puede ser redimido una vez\n' +
        '• Solo puede usarse en un dispositivo\n' +
        '• El mal uso puede resultar en cancelación';

      await this.bot.sendMessage(chatId, telegramMessage, {
        reply_markup: MAIN_KEYBOARD,
      });

      // Mensaje simplificado para WhatsApp
      const whatsappMessage =
        `¡Token generado exitosamente!\n\n` +
        `Token: ${result.token}\n` +
        `Usuario: ${userData.name}\n` +
        `Email: ${userData.email}\n` +
        `Teléfono: ${userData.phone}\n` +
        `Válido hasta: ${result.expiresAt.toLocaleDateString()}\n\n` +
        'IMPORTANTE:\n' +
        '• Este token solo puede ser redimido una vez\n' +
        '• Solo puede usarse en un dispositivo\n' +
        '• El mal uso puede resultar en cancelación';

      // Construir URLs
      const phoneNumber = userData.phone.replace(/\D/g, '');
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(whatsappMessage)}`;

      // URL para Gmail
      const emailSubject = 'Tu Token de Licencia';
      const emailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(userData.email)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(telegramMessage)}`;

      // Enviar botones
      await this.bot.sendMessage(chatId, '📤 Opciones para compartir:', {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📱 Compartir por WhatsApp',
                url: whatsappUrl,
              },
            ],
            [
              {
                text: '📧 Abrir en Gmail',
                url: emailUrl,
              },
            ],
          ],
        },
      });

      // Fire-and-forget: enviar email de bienvenida sin bloquear
      void sendWelcomeEmail({
        email: userData.email,
        name: userData.name,
        token: result.token,
        expiresAt: result.expiresAt,
      }).then((emailResult) => {
        const msg = emailResult.success
          ? `✅ Email enviado a ${userData.email}`
          : `⚠️ Email no enviado: ${emailResult.message}`;
        void this.bot.sendMessage(chatId, msg);
      });
    } catch (error: unknown) {
      console.error('Error al generar token:', error instanceof Error ? error.message : error);
      await this.bot.sendMessage(
        chatId,
        '❌ Error al generar el token. Por favor, intenta nuevamente.',
      );
    }
  }

  validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  validatePhone(phone: string): boolean {
    return /^\+?\d{10,}$/.test(phone.replace(/[\s-]/g, ''));
  }
}

// ---------------------------------------------------------------------------
// Singleton + CommonJS compat
// ---------------------------------------------------------------------------

const telegramServiceInstance = new TelegramService();
export default telegramServiceInstance;
