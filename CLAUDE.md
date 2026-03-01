# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

IKE License Manager — sistema de gestión de tokens de licencia con API REST, bot de Telegram y exportación/importación Excel. Desplegado en Railway con PostgreSQL.

## Comandos

```bash
npm run build       # Genera Prisma Client + compila TypeScript
npm start           # Inicia el servidor (node dist/app.js)
npm run dev         # Desarrollo con hot-reload (prisma generate + tsx watch)
npm run typecheck   # Verificar tipos sin emitir
npm run lint        # ESLint
npm run format      # Prettier
npm run check       # typecheck + lint + format check
```

Scripts de Prisma:

```bash
npm run prisma:generate  # Genera el Prisma Client
npm run prisma:migrate   # Crea/aplica migraciones de desarrollo
npm run prisma:studio    # UI visual para la base de datos
```

Scripts de datos (ejecutar directamente):

```bash
npx tsx src/scripts/exportTokens.ts   # Exporta tokens a Excel
npx tsx src/scripts/importTokens.ts   # Importa tokens desde Excel
npx tsx src/scripts/deleteDatabase.ts # Elimina todos los tokens
```

## Arquitectura

**Stack**: Express.js + PostgreSQL (Prisma) + node-telegram-bot-api

**Punto de entrada**: `src/app.ts` — conecta PostgreSQL via Prisma, monta rutas en `/api`, configura webhook de Telegram en producción.

**Flujo principal**: Routes → Controllers → Services → Prisma Client

```
src/
├── config/       # config.ts (env vars), database.ts (conexión PostgreSQL via Prisma)
├── controllers/  # apiController.ts (REST), telegramController.ts
├── generated/    # Prisma Client generado (NO editar, NO commitear)
├── lib/          # prisma.ts (singleton PrismaClient con adapter pg)
├── models/       # tokenModel.ts (tipos de compatibilidad, re-exports de Prisma)
├── routes/       # apiRoutes.ts (/api/*), telegramRoutes.ts
├── services/     # tokenService.ts (lógica core), telegramService.ts (bot), authService.ts (JWT)
├── scripts/      # Utilidades de importación/exportación Excel
└── utils/        # helper.ts
prisma/
├── schema.prisma # Schema de la base de datos
└── migrations/   # Migraciones SQL generadas
```

### Modelo Token (único modelo)

Definido en `prisma/schema.prisma`. Campos clave: `token` (hex 32 chars, único), `email`, `name`, `phone`, `expiresAt`, `isRedeemed`, `machineId`, `redemptionIp`, `redemptionDeviceInfo`, `redemptionTimestamp`.

**Nota**: Los campos de redención (`redemptionIp`, `redemptionDeviceInfo`, `redemptionTimestamp`) son columnas planas en PostgreSQL. El helper `getRedemptionDetails()` en `tokenModel.ts` los reconstruye como objeto cuando se necesita compatibilidad.

**Lógica de expiración**: los tokens expiran el **primer día del mes siguiente** a su creación/redención, no por duración fija.

### API REST (prefijo `/api`)

- `GET /status` — health check (publico)
- `POST /login` — obtener JWT admin (body: `adminKey`) (publico, rate limited: 5 intentos/15min)
- `POST /validate` — valida y redime un token, body: `token`, `machineId` (publico, maquina-a-servidor)
- `GET /check-validity/:token` — verifica validez sin redimir (publico, maquina-a-servidor)
- `GET /tokens` — lista todos los tokens con paginacion (protegido, requiere `Authorization: Bearer <JWT>`)

### Bot de Telegram

- Clase singleton en `telegramService.ts` con estado conversacional via `Map`
- **Polling** en desarrollo, **Webhook** en producción (Railway)
- Webhook endpoint: `POST /api/telegram-webhook`
- Comandos: `/start`, `/help`, `/generar_token`, `/listar_tokens`, `/tokens_caducando`, `/tokens_expirados`
- Callbacks inline para renovar (por meses) y eliminar tokens

### Entorno

Variables requeridas: `DATABASE_URL`, `TELEGRAM_TOKEN`, `ADMIN_CHAT_ID`, `ADMIN_API_KEY`, `JWT_SECRET`, `NODE_ENV`.

- `DATABASE_URL` — connection string de PostgreSQL (ej: `postgresql://user:password@host:5432/dbname`)
- `ADMIN_CHAT_ID` — usado por el bot de Telegram para verificar administrador.
- `ADMIN_API_KEY` — clave secreta para autenticacion en `POST /login` (API REST). No debe ser el mismo valor que `ADMIN_CHAT_ID`.

La detección de producción usa `NODE_ENV === 'production'` **o** la presencia de `RAILWAY_ENVIRONMENT_NAME`.

## Convenciones

- TypeScript strict con compilación a CommonJS.
- Async/await en todo el código asíncrono.
- Los mensajes del bot y logs usan español con emojis.
- `authService.ts` provee JWT utilities, integrado como middleware en `authMiddleware.ts` para proteger endpoints admin (`GET /tokens`).
- Prisma Client se inicializa como singleton en `src/lib/prisma.ts` con `@prisma/adapter-pg`.
