# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

IKE License Manager — sistema de gestión de tokens de licencia con API REST, bot de Telegram y exportación/importación Excel. Desplegado en Railway con MongoDB Atlas.

## Comandos

```bash
npm start          # Inicia el servidor (node src/app.js)
npm run dev        # Desarrollo con hot-reload (nodemon src/app.js)
```

Scripts de datos (ejecutar directamente):

```bash
node src/scripts/exportTokens.js   # Exporta tokens a Excel
node src/scripts/importTokens.js   # Importa tokens desde Excel
node src/scripts/deleteDatabase.js # Elimina la base de datos
```

No hay tests configurados actualmente.

## Arquitectura

**Stack**: Express.js + MongoDB (Mongoose) + node-telegram-bot-api

**Punto de entrada**: `src/app.js` — conecta MongoDB, monta rutas en `/api`, configura webhook de Telegram en producción.

**Flujo principal**: Routes → Controllers → Services → Models

```
src/
├── config/       # config.js (env vars), database.js (conexión Mongo)
├── controllers/  # apiController.js (REST), telegramController.js
├── models/       # tokenModel.js (único modelo)
├── routes/       # apiRoutes.js (/api/*), telegramRoutes.js
├── services/     # tokenService.js (lógica core), telegramService.js (bot), authService.js (JWT)
├── scripts/      # Utilidades de importación/exportación Excel
└── utils/        # helper.js
```

### Modelo Token (único modelo)

Campos clave: `token` (hex 32 chars, único), `email`, `name`, `phone`, `expiresAt`, `isRedeemed`, `machineId`, `redemptionDetails`.

**Lógica de expiración**: los tokens expiran el **primer día del mes siguiente** a su creación/redención, no por duración fija.

### API REST (prefijo `/api`)

- `GET /status` — health check (publico)
- `POST /login` — obtener JWT admin (body: `adminKey`) (publico, rate limited: 5 intentos/15min)
- `POST /validate` — valida y redime un token, body: `token`, `machineId` (publico, maquina-a-servidor)
- `GET /check-validity/:token` — verifica validez sin redimir (publico, maquina-a-servidor)
- `GET /tokens` — lista todos los tokens con paginacion (protegido, requiere `Authorization: Bearer <JWT>`)

### Bot de Telegram

- Clase singleton en `telegramService.js` con estado conversacional via `Map`
- **Polling** en desarrollo, **Webhook** en producción (Railway)
- Webhook endpoint: `POST /api/telegram-webhook`
- Comandos: `/start`, `/help`, `/generar_token`, `/listar_tokens`, `/tokens_caducando`, `/tokens_expirados`
- Callbacks inline para renovar (por meses) y eliminar tokens

### Entorno

Variables requeridas (ver `.env.example`): `MONGODB_URI`, `TELEGRAM_TOKEN`, `ADMIN_CHAT_ID`, `ADMIN_API_KEY`, `JWT_SECRET`, `NODE_ENV`.

- `ADMIN_CHAT_ID` — usado por el bot de Telegram para verificar administrador.
- `ADMIN_API_KEY` — clave secreta para autenticacion en `POST /login` (API REST). No debe ser el mismo valor que `ADMIN_CHAT_ID`.

La detección de producción usa `NODE_ENV === 'production'` **o** la presencia de `RAILWAY_ENVIRONMENT_NAME`.

## Convenciones

- Todo el código usa `require`/`module.exports` (CommonJS), no ES modules.
- Async/await en todo el código asíncrono.
- Los mensajes del bot y logs usan español con emojis.
- `authService.ts` provee JWT utilities, integrado como middleware en `authMiddleware.ts` para proteger endpoints admin (`GET /tokens`).
