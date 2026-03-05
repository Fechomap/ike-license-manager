# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

IKE License Manager — sistema de gestión de tokens de licencia con API REST, bot de Telegram y exportación/importación Excel. Desplegado en Railway con PostgreSQL.

## Comandos

```bash
npm run build       # Genera Prisma Client + compila TypeScript
npm start           # Migra BD + inicia servidor (prisma migrate deploy + node dist/app.js)
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
├── controllers/  # apiController.ts (REST)
├── generated/    # Prisma Client generado (NO editar, NO commitear)
├── lib/          # prisma.ts (singleton PrismaClient con adapter pg)
├── middleware/   # authMiddleware.ts (JWT Bearer validation)
├── models/       # tokenModel.ts (tipos de compatibilidad, re-exports de Prisma)
├── routes/       # apiRoutes.ts (/api/*)
├── services/     # tokenService.ts (lógica core), telegramService.ts (bot), authService.ts (JWT)
└── scripts/      # Utilidades de importación/exportación Excel
prisma/
├── schema.prisma # Schema de la base de datos
└── migrations/   # Migraciones SQL generadas
```

### Modelos de datos

Definidos en `prisma/schema.prisma`.

**Enum `TokenStatus`**: `active`, `expired`, `suspended`, `cancelled`.

**Modelo Token**: `token` (hex 32 chars, unico), `email`, `name`, `phone`, `expiresAt`, `isRedeemed`, `machineId` (legacy, primera maquina), `status` (TokenStatus, default: active), `statusReason`, `redemptionIp`, `redemptionDeviceInfo`, `redemptionTimestamp`, `payments` (relacion con Payment), `machines` (relacion con Machine).

**Modelo Machine**: `machineId` (String), `deviceInfo` (opcional), `ip` (opcional), `addedAt` (DateTime), `tokenId` (FK a Token, cascade delete). Constraint unique en `[tokenId, machineId]`. Cada token soporta hasta `MAX_MACHINES_PER_TOKEN` (3) dispositivos.

**Modelo Payment**: `amount` (Float), `months` (Int), `paidAt` (DateTime), `note` (opcional), `tokenId` (FK a Token, cascade delete). Indices en `tokenId` y `paidAt`.

**Nota**: Los campos de redencion (`redemptionIp`, `redemptionDeviceInfo`, `redemptionTimestamp`) son columnas planas en PostgreSQL. El helper `getRedemptionDetails()` en `tokenModel.ts` los reconstruye como objeto cuando se necesita compatibilidad. El campo `machineId` en Token se mantiene por compatibilidad (primera maquina registrada).

**Logica de expiracion**: los tokens expiran el **primer dia del mes siguiente** a su creacion/redencion, no por duracion fija. Los pagos ($1,500 MXN/mes) auto-renuevan el token calculando meses = monto/1500.

**Multi-maquina**: Un token puede registrarse en hasta 3 dispositivos (`MAX_MACHINES_PER_TOKEN`). La primera maquina marca el token como redimido y establece `expiresAt`. Las siguientes solo crean registros en la tabla `machines`. Si se alcanza el limite, `POST /validate` retorna `errorCode: 'MAX_MACHINES_REACHED'`. El admin puede liberar dispositivos desde Telegram (boton "Dispositivos" → "Liberar"). `renewToken` elimina todas las maquinas registradas.

### API REST (prefijo `/api`)

- `GET /status` — health check (publico)
- `POST /login` — obtener JWT admin (body: `adminKey`) (publico, rate limited: 5 intentos/15min)
- `POST /validate` — valida y redime un token, body: `token`, `machineId` (publico, maquina-a-servidor). Soporta hasta 3 dispositivos. Retorna `errorCode: 'MAX_MACHINES_REACHED'` si se excede el limite.
- `GET /check-validity/:token` — verifica validez sin redimir (publico, maquina-a-servidor)
- `GET /tokens` — lista todos los tokens con paginacion (protegido, requiere `Authorization: Bearer <JWT>`)
- `PATCH /tokens/:token/status` — actualiza status de un token (protegido, requiere JWT)

### Bot de Telegram

- Clase singleton en `telegramService.ts` con estado conversacional via `Map`
- **Polling** en desarrollo, **Webhook** en producción (Railway)
- Webhook endpoint: `POST /api/telegram-webhook`
- Comandos: `/start`, `/generar_token`, `/listar_tokens`, `/tokens_caducando`, `/tokens_expirados`, `/exportar_excel`
- Callbacks inline: `filter:*` (filtros), `pay:*` (registrar pago), `delete:*`, `suspend:*`, `cancel:*`, `reactivate:*`, `devices:*` (gestionar dispositivos), `rmdev:*` (liberar dispositivo)
- Flujo conversacional de pago: monto (multiplo de $1,500) → fecha (DD/MM/AAAA o "hoy") → auto-renovacion

### Entorno

Variables requeridas: `DATABASE_URL`, `TELEGRAM_TOKEN`, `ADMIN_CHAT_ID`, `ADMIN_API_KEY`, `JWT_SECRET`, `NODE_ENV`.

- `DATABASE_URL` — connection string de PostgreSQL (ej: `postgresql://user:password@host:5432/dbname`)
- `ADMIN_CHAT_ID` — usado por el bot de Telegram para verificar administrador.
- `ADMIN_API_KEY` — clave secreta para autenticacion en `POST /login` (API REST). No debe ser el mismo valor que `ADMIN_CHAT_ID`.

La detección de producción usa `NODE_ENV === 'production'` **o** la presencia de `RAILWAY_ENVIRONMENT_NAME`.

## Convenciones

- TypeScript strict. En desarrollo se usa `tsx` (esbuild). En produccion, Docker ejecuta `tsx src/app.ts` directamente (Prisma 7 genera ESM nativo en Node 22, incompatible con tsc module:commonjs).
- Async/await en todo el codigo asincrono.
- Los mensajes del bot y logs usan espanol con emojis.
- `authService.ts` provee JWT utilities, integrado como middleware en `authMiddleware.ts` para proteger endpoints admin (`GET /tokens`, `PATCH /tokens/:token/status`).
- Prisma Client se inicializa como singleton en `src/lib/prisma.ts` con `@prisma/adapter-pg`.
- Deploy via Docker en Railway (`Dockerfile` + `.dockerignore`). CMD: `prisma migrate deploy && tsx src/app.ts`.
