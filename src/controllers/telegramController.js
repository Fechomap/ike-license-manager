// src/controllers/telegramController.js
const telegramService = require('../services/telegramService');

class TelegramController {
  async handleGenerateToken(msg, match) {
    try {
      const chatId = msg.chat.id;
      const [email, name, phone] = match[1].split(' ');
      
      if (!email || !name || !phone) {
        return {
          chatId,
          message: 'Formato incorrecto. Use: /generar_token email nombre telefono'
        };
      }

      const userData = { email, name, phone };
      const result = await telegramService.generateToken(userData);
      
      return {
        chatId,
        message: `Token generado: ${result.token}\nVálido hasta: ${result.expiresAt}`
      };
    } catch (error) {
      console.error('Error en handleGenerateToken:', error);
      return {
        chatId: msg.chat.id,
        message: 'Error al generar el token. Por favor, intente nuevamente.'
      };
    }
  }

  async handleExpiringTokens(msg, days = 7) {
    try {
      const tokens = await telegramService.getExpiringTokens(days);
      if (!tokens.length) {
        return {
          chatId: msg.chat.id,
          message: 'No hay tokens próximos a vencer.'
        };
      }

      const message = tokens.map(token => 
        `Token: ${token.token} - Vence: ${token.expiresAt.toLocaleDateString()}`
      ).join('\n');

      return {
        chatId: msg.chat.id,
        message: `Tokens próximos a vencer:\n${message}`
      };
    } catch (error) {
      console.error('Error en handleExpiringTokens:', error);
      return {
        chatId: msg.chat.id,
        message: 'Error al consultar tokens. Por favor, intente nuevamente.'
      };
    }
  }

  handleHelp(msg) {
    return {
      chatId: msg.chat.id,
      message: `
'🔍 Comandos disponibles:\n\n' +
'🎯 /generar_token - Genera un nuevo token\n' +
'📋 /listar_tokens - Muestra todos los tokens\n' +
'⚠️ /tokens_caducando - Lista tokens próximos a vencer\n' +
'❌ /tokens_expirados - Lista tokens expirados\n' +
'❓ /help - Muestra este mensaje'
      `.trim()
    };
  }

  handlePing(msg) {
    return {
      chatId: msg.chat.id,
      message: 'pong!'
    };
  }
}

module.exports = new TelegramController();