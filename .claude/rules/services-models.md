---
paths:
  - "src/services/**/*.ts"
  - "src/models/**/*.ts"
  - "src/config/**/*.ts"
  - "src/lib/**/*.ts"
---

# Reglas Services, Models y Config

## Services (src/services/)

### tokenService.ts (Logica Core)
- Generacion de tokens: 32 chars hex con crypto.randomBytes
- Expiracion: SIEMPRE al 1er dia del mes siguiente (no duracion fija)
- Redencion: one-time con binding a machineId
- Redencion DEBE ser atomica: usar `updateMany` condicional, NUNCA read-then-write
- NUNCA modificar logica de expiracion sin validar con tests
- Funciones criticas: createToken, validateAndRedeemToken, renewToken

### telegramService.ts (Bot Telegram)
- Clase singleton con patron constructor
- Estado conversacional: Map<chatId, { step, data }>
- Modo dual: Polling (dev) / Webhook (prod) segun config.isProduction
- NUNCA instanciar multiples bots (causa conflictos de polling)
- Al agregar comandos: registrar con bot.onText + agregar a /help
- Callbacks inline: usar patron `callback_data` con prefijo (ej: `renew:tokenId`)

### authService.ts (JWT)
- generateToken y verifyToken implementados
- Integrado como middleware en authMiddleware.ts para proteger endpoints admin
- JWT_SECRET desde variables de entorno

## Models (src/models/)

### tokenModel.ts (Tipos de compatibilidad)
- Re-exporta tipo `Token` generado por Prisma
- Provee `IToken` e `IRedemptionDetails` como interfaces de compatibilidad
- Helper `getRedemptionDetails()` reconstruye subdocumento desde columnas planas
- Al agregar campos al modelo: modificar `prisma/schema.prisma`, generar migracion, actualizar tipos aqui

### Schema Prisma (prisma/schema.prisma)
- Modelo Token con campos: id, token, email, name, phone, createdAt, expiresAt, isRedeemed, redeemedAt, machineId, redemptionIp, redemptionDeviceInfo, redemptionTimestamp
- Campo `token` es unique
- Indices: expiresAt, isRedeemed
- Tabla mapeada como `tokens` (@@map)
- SIEMPRE generar migracion despues de modificar el schema

## Lib (src/lib/)

### prisma.ts (Singleton PrismaClient)
- Usa @prisma/adapter-pg con connection string de DATABASE_URL
- NUNCA crear multiples instancias de PrismaClient
- Importar siempre desde `../lib/prisma`, no instanciar directamente

## Config (src/config/)

### config.ts
- Centralizacion de variables de entorno
- isProduction: NODE_ENV === 'production' || !!RAILWAY_ENVIRONMENT_NAME
- SIEMPRE agregar nuevas variables aqui, no leer process.env directamente en otros archivos
- DATABASE_URL es la variable de conexion a PostgreSQL

### database.ts
- Conexion a PostgreSQL via prisma.$connect()
- Exporta connectDB() y disconnectDB()
