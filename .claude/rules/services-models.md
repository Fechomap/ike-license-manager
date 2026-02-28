---
paths:
  - "src/services/**/*.js"
  - "src/models/**/*.js"
  - "src/config/**/*.js"
---

# Reglas Services y Models

## Services (src/services/)

### tokenService.js (Logica Core)
- Generacion de tokens: 32 chars hex con crypto.randomBytes
- Expiracion: SIEMPRE al 1er dia del mes siguiente (no duracion fija)
- Redencion: one-time con binding a machineId
- NUNCA modificar logica de expiracion sin validar con tests
- Funciones criticas: createToken, validateAndRedeemToken, renewToken

### telegramService.js (Bot Telegram)
- Clase singleton con patron constructor
- Estado conversacional: Map<chatId, { step, data }>
- Modo dual: Polling (dev) / Webhook (prod) segun config.isProduction
- NUNCA instanciar multiples bots (causa conflictos de polling)
- Al agregar comandos: registrar con bot.onText + agregar a /help
- Callbacks inline: usar patron `callback_data` con prefijo (ej: `renew_3_tokenId`)

### authService.js (JWT)
- generateToken y verifyToken implementados
- NO esta integrado como middleware — disponible para uso futuro
- JWT_SECRET desde variables de entorno

## Models (src/models/)

### tokenModel.js (Unico Modelo)
- Schema Mongoose con campos: token, email, name, phone, createdAt, expiresAt, isRedeemed, redeemedAt, machineId, redemptionDetails
- Campo `token` es unique + required
- Al agregar campos: definir default y validaciones en el schema
- Indices: token (unique)

## Config (src/config/)

### config.js
- Centralizacion de variables de entorno
- isProduction: NODE_ENV === 'production' || !!RAILWAY_ENVIRONMENT_NAME
- SIEMPRE agregar nuevas variables aqui, no leer process.env directamente en otros archivos

### database.js
- Conexion a MongoDB via mongoose.connect con MONGODB_URI
- Retry automatico gestionado por Mongoose
