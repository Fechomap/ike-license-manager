---
paths:
  - "src/services/telegramService.js"
  - "src/controllers/telegramController.js"
  - "src/routes/telegramRoutes.js"
---

# Reglas Bot de Telegram

## Arquitectura del Bot
- Singleton en telegramService.js: una unica instancia del bot
- Polling en desarrollo (automatico), Webhook en produccion (Railway)
- Webhook URL: `https://{RAILWAY_PUBLIC_DOMAIN}/api/telegram-webhook`
- ADMIN_CHAT_ID restringe acceso a ciertos comandos

## Estado Conversacional
- Map<chatId, { step, data }> para flujos multi-paso
- Flujo /generar_token: email -> name -> phone -> crear token
- Limpiar estado al completar o cancelar operacion
- CUIDADO: el Map no tiene TTL — sesiones abandonadas persisten en memoria

## Comandos
- /start: Mensaje de bienvenida
- /help: Lista de comandos disponibles
- /generar_token: Flujo interactivo de generacion
- /listar_tokens: Muestra todos los tokens
- /tokens_caducando: Tokens por expirar
- /tokens_expirados: Tokens expirados con botones de accion

## Callbacks Inline
- Patron: `bot.on('callback_query', handler)`
- callback_data con formato: `accion_parametro1_parametro2`
- Responder SIEMPRE con answerCallbackQuery para evitar loading spinner
- Ejemplo: `renew_3_65f1a2b3c4d5e6f7` (renovar 3 meses, tokenId)

## Rate Limiting
- Funcion sleep() entre mensajes para evitar flood limit de Telegram
- Al enviar listas largas, agregar delay entre cada mensaje

## Seguridad
- Validar chatId contra ADMIN_CHAT_ID para operaciones sensibles
- No enviar tokens completos por Telegram (truncar)
- No loguear contenido de mensajes del usuario
