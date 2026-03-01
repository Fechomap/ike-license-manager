// src/services/telegramService.ts
import TelegramBot from 'node-telegram-bot-api';

import config from '../config/config';

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
  step: 'email' | 'name' | 'phone';
  data: Partial<UserData>;
}

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
    this.bot.onText(/\/start/, (msg: TelegramBot.Message) => {
      void this.handleStart(msg);
    });
    this.bot.onText(/\/help/, (msg: TelegramBot.Message) => {
      void this.handleHelp(msg);
    });
    this.bot.onText(/\/generar_token/, (msg: TelegramBot.Message) => {
      void this.startTokenGeneration(msg);
    });

    // Comando para listar tokens
    this.bot.onText(/\/listar_tokens/, (msg: TelegramBot.Message) => {
      void this.handleListTokens(msg);
    });

    // Comando para ver tokens próximos a expirar
    this.bot.onText(/\/tokens_caducando/, (msg: TelegramBot.Message) => {
      void this.handleTokensExpiringSoon(msg);
    });

    // Comando para tokens expirados
    this.bot.onText(/\/tokens_expirados/, (msg: TelegramBot.Message) => {
      void this.handleExpiredTokens(msg);
    });

    // Manejador de callbacks para los botones
    this.bot.on('callback_query', (query: TelegramBot.CallbackQuery) => {
      void this.handleCallbackQuery(query);
    });

    this.bot.on('message', (msg: TelegramBot.Message) => {
      void this.handleMessage(msg);
    });
  }

  async handleListTokens(msg: TelegramBot.Message): Promise<void> {
    try {
      // Notificamos que estamos procesando
      await this.bot.sendMessage(msg.chat.id, '⏳ Obteniendo lista de tokens...');

      // Obtenemos los tokens
      const tokens = await tokenService.getAllTokens();

      if (!tokens || tokens.length === 0) {
        await this.bot.sendMessage(msg.chat.id, '📋 No hay tokens para mostrar.');
        return;
      }

      await this.bot.sendMessage(
        msg.chat.id,
        `📋 Encontrados ${tokens.length} tokens. Procesando lista...`,
      );

      for (const token of tokens) {
        if (!token || !token.token) {
          continue;
        }

        const status = token.isRedeemed ? '✅ Canjeado' : '⏳ No canjeado';
        const days = token.remainingDays || 0;

        // SIN formato Markdown - texto plano
        const tokenMessage =
          `🔑 Token: ${token.token}\n` +
          `👤 Usuario: ${token.name || 'N/A'}\n` +
          `📧 Email: ${token.email || 'N/A'}\n` +
          `📅 Estado: ${status}\n` +
          `⏰ Días restantes: ${days}`;

        await this.bot.sendMessage(msg.chat.id, tokenMessage);

        // Pequeña pausa entre mensajes
        await this.sleep(300);
      }

      await this.bot.sendMessage(msg.chat.id, '✅ Lista completada');
    } catch (error: unknown) {
      console.error('Error al listar tokens:', error instanceof Error ? error.message : error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error al obtener la lista de tokens');
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
          `📅 Fecha de expiración: ${token.expiresAt.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}\n` +
          `${token.isRedeemed ? '✅ Token redimido' : '❌ Token no redimido'}`;

        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: '🔄 Renovar',
                callback_data: `renew:${token.token}`,
              },
              {
                text: '🗑️ Borrar',
                callback_data: `delete:${token.token}`,
              },
            ],
          ],
        };

        await this.bot.sendMessage(msg.chat.id, message, {
          reply_markup: inlineKeyboard,
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

  async handleCallbackQuery(query: TelegramBot.CallbackQuery): Promise<void> {
    const data = query.data;
    if (!data) {
      return;
    }

    const parts = data.split(':');
    const action = parts[0];
    const tokenId = parts[1];
    const months = parts[2];

    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;

    if (!chatId || !messageId) {
      return;
    }

    try {
      switch (action) {
        case 'renew':
          // Mostrar opciones de renovación por meses
          await this.bot.editMessageReplyMarkup(
            {
              inline_keyboard: [
                [
                  { text: '1 Mes', callback_data: `extend:${tokenId}:1` },
                  { text: '2 Meses', callback_data: `extend:${tokenId}:2` },
                  { text: '3 Meses', callback_data: `extend:${tokenId}:3` },
                ],
              ],
            },
            {
              chat_id: chatId,
              message_id: messageId,
            },
          );
          break;

        case 'extend': {
          if (!tokenId || !months) {
            break;
          }
          const updatedToken = await tokenService.renewToken(tokenId, parseInt(months, 10));

          const newExpiryDate = updatedToken.expiresAt.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });

          await this.bot.editMessageText(
            `✅ Token renovado por ${months} ${months === '1' ? 'mes' : 'meses'}.\n` +
              `Nueva fecha de expiración: ${newExpiryDate}`,
            {
              chat_id: chatId,
              message_id: messageId,
            },
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
      '🎉 ¡Bienvenido al Bot de Gestión de Licencias!\n' +
        'Usa /help para ver los comandos disponibles.',
    );
  }

  async handleHelp(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    await this.bot.sendMessage(
      chatId,
      '🔍 Comandos disponibles:\n\n' +
        '🎯 /generar_token - Genera un nuevo token\n' +
        '📋 /listar_tokens - Muestra todos los tokens\n' +
        '⚠️ /tokens_caducando - Lista tokens próximos a vencer\n' +
        '❌ /tokens_expirados - Lista tokens expirados\n' +
        '❓ /help - Muestra este mensaje',
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

    if (!userState) {
      return;
    }

    const text = msg.text;
    if (!text) {
      return;
    }

    switch (userState.step) {
      case 'email':
        if (this.validateEmail(text)) {
          userState.data.email = text;
          userState.step = 'name';
          await this.bot.sendMessage(chatId, '👤 Por favor, ingresa el nombre completo:');
        } else {
          await this.bot.sendMessage(
            chatId,
            '❌ Email inválido. Por favor, intenta nuevamente o usa /generar_token para comenzar de nuevo.',
          );
          this.userStates.delete(chatId);
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
          await this.bot.sendMessage(
            chatId,
            '❌ Nombre demasiado corto. Por favor, intenta nuevamente o usa /generar_token para comenzar de nuevo.',
          );
          this.userStates.delete(chatId);
        }
        break;

      case 'phone':
        if (this.validatePhone(text)) {
          userState.data.phone = text.replace(/\D/g, '');
          await this.generateAndSendToken(chatId, userState.data as UserData);
          this.userStates.delete(chatId);
        } else {
          await this.bot.sendMessage(
            chatId,
            '❌ Número de teléfono inválido. Por favor, intenta nuevamente o usa /generar_token para comenzar de nuevo.',
          );
          this.userStates.delete(chatId);
        }
        break;
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

      await this.bot.sendMessage(chatId, telegramMessage);

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
