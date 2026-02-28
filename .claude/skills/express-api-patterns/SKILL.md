---
name: express-api-patterns
description: |
  Patrones de API Express y logging para LICENSE-MANAGER.
  USAR cuando necesites agregar endpoints, middleware, logging o buscar patrones existentes.
allowed-tools: Read, Grep
---

# Patrones Express API en LICENSE-MANAGER

El proyecto usa Express.js con Mongoose para MongoDB y node-telegram-bot-api para Telegram.

## Estructura de Capas

| Capa | Ubicacion | Responsabilidad |
|------|-----------|-----------------|
| **Routes** | `src/routes/` | Definir endpoints y mapear a controllers |
| **Controllers** | `src/controllers/` | Parsear request, llamar service, formatear response |
| **Services** | `src/services/` | Logica de negocio, operaciones con modelos |
| **Models** | `src/models/` | Schema Mongoose, validaciones a nivel BD |

---

## Patron: Endpoint API

```javascript
// Route (apiRoutes.js)
router.get('/tokens', apiController.getAllTokens);
router.post('/validate', apiController.validateToken);

// Controller (apiController.js)
const validateToken = async (req, res) => {
  try {
    const { token, machineId } = req.body;
    const result = await tokenService.validateAndRedeemToken(token, machineId, {
      ip: req.ip,
      deviceInfo: req.headers['user-agent']
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Service (tokenService.js)
const validateAndRedeemToken = async (token, machineId, clientInfo) => {
  const tokenDoc = await Token.findOne({ token });
  if (!tokenDoc) throw new Error('Token no encontrado');
  // ... logica de negocio
  return tokenDoc;
};
```

---

## Patron: Comando Telegram

```javascript
// En telegramService.js (clase singleton)
this.bot.onText(/\/generar_token/, (msg) => {
  const chatId = msg.chat.id;
  this.userStates.set(chatId, { step: 'awaiting_email' });
  this.bot.sendMessage(chatId, 'Ingresa el email:');
});

// Manejo de estado conversacional
this.bot.on('message', (msg) => {
  const state = this.userStates.get(msg.chat.id);
  if (!state) return;
  // Procesar segun state.step
});
```

---

## Patron: Token Expiration

```javascript
// Expiracion: 1er dia del mes siguiente
const getFirstDayOfNextMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
};
```

---

## Patron: Webhook vs Polling Telegram

```javascript
// En app.js
if (config.isProduction) {
  // Webhook en produccion (Railway)
  app.post('/api/telegram-webhook', (req, res) => {
    telegramService.bot.processUpdate(req.body);
    res.sendStatus(200);
  });
} else {
  // Polling en desarrollo (automatico por node-telegram-bot-api)
}
```

---

## Respuestas HTTP Estandar

| Status | Uso |
|--------|-----|
| `200` | Operacion exitosa |
| `400` | Error de validacion o token invalido |
| `404` | Token no encontrado |
| `500` | Error interno del servidor |

Formato de respuesta:
```json
{
  "success": true|false,
  "data": { ... },
  "message": "descripcion del error"
}
```

---

## Datos Sensibles - NUNCA loguear

- Tokens de licencia completos (solo primeros 8 chars)
- MongoDB URI completa
- JWT_SECRET
- TELEGRAM_TOKEN
- Datos personales de usuarios (email, telefono) en logs de produccion
