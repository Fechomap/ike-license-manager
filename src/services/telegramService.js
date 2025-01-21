// src/services/telegramService.js
const TelegramBot = require('node-telegram-bot-api');
const tokenService = require('./tokenService');
const config = require('../config/config');

class TelegramService {
  constructor() {
    this.bot = new TelegramBot(config.telegramToken, { polling: true });
    this.userStates = new Map();
    this.initializeCommands();
  }

  initializeCommands() {
    this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
    this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));
    this.bot.onText(/\/generar_token/, (msg) => this.startTokenGeneration(msg));
    
    // Comando para listar tokens
    this.bot.onText(/\/listar_tokens/, async (msg) => {
      try {
        const tokens = await tokenService.getAllTokens();
        let message = '📋 Lista de tokens:\n\n';
    
        tokens.forEach(token => {
          const status = token.isRedeemed ? '✅ Canjeado' : '⏳ No canjeado';
          message += `🔑 Token: ${token.token}\n`;
          message += `👤 Usuario: ${token.name}\n`;
          message += `📧 Email: ${token.email}\n`;
          message += `📅 Estado: ${status}\n`;
          message += `⏰ Días restantes: ${token.remainingDays}\n\n`;
        });
    
        const chunkSize = 4000; // Límite aproximado de Telegram
        if (message.length <= chunkSize) {
          // Enviar todo en un solo mensaje si es menor al límite
          await this.bot.sendMessage(msg.chat.id, message);
        } else {
          // Divide en bloques y añade delay
          let startIndex = 0;
          while (startIndex < message.length) {
            const chunk = message.slice(startIndex, startIndex + chunkSize);
            await this.bot.sendMessage(msg.chat.id, chunk);
            startIndex += chunkSize;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay de 1 segundo
          }
        }
    
      } catch (error) {
        console.error('Error al listar tokens:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error al obtener la lista de tokens');
      }
    });

    // Comando para ver tokens próximos a expirar
    this.bot.onText(/\/tokens_caducando/, async (msg) => {
      try {
        const tokens = await tokenService.getTokensExpiringSoon(7);
        if (tokens.length === 0) {
          await this.bot.sendMessage(msg.chat.id, '✨ ¡No hay tokens próximos a expirar!');
          return;
        }

        let message = '⚠️ Tokens próximos a expirar:\n\n';
        tokens.forEach(token => {
          message += `🔑 Token: ${token.token}\n`;
          message += `👤 Usuario: ${token.name}\n`;
          message += `📅 Expira: ${token.expiresAt.toLocaleDateString()}\n\n`;
        });

        await this.bot.sendMessage(msg.chat.id, message);
      } catch (error) {
        console.error('Error al obtener tokens por expirar:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error al consultar tokens próximos a expirar');
      }
    });

    this.bot.on('message', (msg) => this.handleMessage(msg));
  }

  async handleStart(msg) {
    const chatId = msg.chat.id;
    await this.bot.sendMessage(chatId, 
      '🎉 ¡Bienvenido al Bot de Gestión de Licencias!\n' +
      'Usa /help para ver los comandos disponibles.'
    );
  }

  async handleHelp(msg) {
    const chatId = msg.chat.id;
    await this.bot.sendMessage(chatId, 
      '🔍 Comandos disponibles:\n\n' +
      '🎯 /generar_token - Genera un nuevo token\n' +
      '📋 /listar_tokens - Muestra todos los tokens\n' +
      '⚠️ /tokens_caducando - Lista tokens próximos a vencer\n' +
      '❓ /help - Muestra este mensaje'
    );
  }

  async startTokenGeneration(msg) {
    const chatId = msg.chat.id;
    this.userStates.set(chatId, {
      step: 'email',
      data: {}
    });

    await this.bot.sendMessage(chatId, '📧 Por favor, ingresa el correo electrónico del usuario:');
  }

  async handleMessage(msg) {
    const chatId = msg.chat.id;
    const userState = this.userStates.get(chatId);

    if (!userState) return;

    switch (userState.step) {
      case 'email':
        if (this.validateEmail(msg.text)) {
          userState.data.email = msg.text;
          userState.step = 'name';
          await this.bot.sendMessage(chatId, '👤 Por favor, ingresa el nombre completo:');
        } else {
          await this.bot.sendMessage(chatId, '❌ Email inválido. Por favor, intenta nuevamente o usa /generar_token para comenzar de nuevo.');
          this.userStates.delete(chatId);
        }
        break;

      case 'name':
        if (msg.text.length >= 3) {
          userState.data.name = msg.text;
          userState.step = 'phone';
          await this.bot.sendMessage(chatId, '📱 Por favor, ingresa el número de teléfono (solo números):');
        } else {
          await this.bot.sendMessage(chatId, '❌ Nombre demasiado corto. Por favor, intenta nuevamente o usa /generar_token para comenzar de nuevo.');
          this.userStates.delete(chatId);
        }
        break;

      case 'phone':
        if (this.validatePhone(msg.text)) {
          userState.data.phone = msg.text.replace(/\D/g, '');
          await this.generateAndSendToken(chatId, userState.data);
          this.userStates.delete(chatId);
        } else {
          await this.bot.sendMessage(chatId, '❌ Número de teléfono inválido. Por favor, intenta nuevamente o usa /generar_token para comenzar de nuevo.');
          this.userStates.delete(chatId);
        }
        break;
    }
  }

  async generateAndSendToken(chatId, userData) {
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
                url: whatsappUrl
              }
            ],
            [
              {
                text: '📧 Abrir en Gmail',
                url: emailUrl
              }
            ]
          ]
        }
      });
  
    } catch (error) {
      console.error('Error al generar token:', error);
      await this.bot.sendMessage(chatId, '❌ Error al generar el token. Por favor, intenta nuevamente.');
    }
  }

  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  validatePhone(phone) {
    return /^\+?\d{10,}$/.test(phone.replace(/[\s-]/g, ''));
  }
}

module.exports = new TelegramService();