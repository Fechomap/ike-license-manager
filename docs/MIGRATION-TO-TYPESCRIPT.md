# Migracion a TypeScript — LICENSE-MANAGER

## Estado del Proyecto Pre-Migracion

- **Stack actual**: Express.js + MongoDB (Mongoose) + node-telegram-bot-api
- **Archivos JS**: 15 en `src/` (~1,300 lineas totales)
- **Modulo system**: CommonJS (`require`/`module.exports`)
- **Deploy**: Railway con MongoDB Atlas

---

## Bugs Detectados (a corregir en Fase 0)

| # | Descripcion | Archivo | Lineas |
|---|-------------|---------|--------|
| BUG-1 | `this.getFirstDayOfNextMonthAfterMonths()` en arrow functions de exports — `this` es fragil en CommonJS y se rompe en ESM | `tokenService.js` | 51, 209, 249 |
| BUG-2 | `tokenService.getTotalTokens()` — funcion inexistente | `apiController.js` | 62 |
| BUG-3 | `getAllTokens(skip, limit)` — la funcion no acepta parametros, paginacion rota | `apiController.js` | 61 |
| BUG-4 | `telegramService.sendMessage()` — metodo inexistente, deberia ser `telegramService.bot.sendMessage()` | `apiController.js` | 112 |
| BUG-5 | `sendTokensToTelegram` usa `token.user`, `token.status`, `token.daysRemaining` — campos inexistentes en el modelo (son `name`, `isRedeemed`, `remainingDays`) | `apiController.js` | 96-98 |
| BUG-6 | `req.connection.remoteAddress` — deprecated desde Node 13+, @types/express no lo incluye | `apiController.js` | 10 |

---

## Deuda Tecnica Detectada

| # | Descripcion | Archivo |
|---|-------------|---------|
| DT-1 | Archivo completamente vacio | `utils/helper.js` |
| DT-2 | Controller con metodos que llaman funciones inexistentes, nunca se invoca | `controllers/telegramController.js` |
| DT-3 | Router que nunca se monta en app.js, importa controller sin usarlo | `routes/telegramRoutes.js` |
| DT-4 | Utilidades JWT funcionales pero nunca integradas como middleware | `services/authService.js` |
| DT-5 | 4 dependencias instaladas pero nunca importadas: `cors`, `nodemailer`, `stripe`, `whatsapp-web.js` | `package.json` |
| DT-6 | `axios` instalado como extraneous (no esta en package.json) | `node_modules/` |
| DT-7 | `validateToken` e `isTokenValid` — funciones duplicadas con la misma logica | `tokenService.js` |
| DT-8 | `Token.deleteOne()` directo en callback, bypasea tokenService | `telegramService.js:206` |
| DT-9 | GET /api/tokens envia tokens a Telegram como side-effect | `apiController.js:65` |
| DT-10 | PORT definido dos veces (app.js y config.js) | `app.js:8`, `config.js:5` |
| DT-11 | Script importTokens usa fallback de 90 dias fijos en vez de "primer dia del mes siguiente" | `scripts/importTokens.js:87` |

---

## Compatibilidad de Dependencias con TypeScript

| Paquete | Version | Tipos | Accion |
|---------|---------|-------|--------|
| `express` | ^4.21.2 | `@types/express` | Instalar |
| `mongoose` | ^8.9.5 | Bundled | Ninguna |
| `dotenv` | ^16.4.7 | Bundled | Ninguna |
| `jsonwebtoken` | ^9.0.2 | `@types/jsonwebtoken` | Instalar |
| `node-telegram-bot-api` | ^0.66.0 | `@types/node-telegram-bot-api` | Instalar |
| `xlsx` | ^0.18.5 | Bundled | Ninguna |
| `nodemon` (dev) | ^3.1.9 | N/A | N/A |

---

## Interfaces TypeScript Planificadas

```typescript
// --- Model ---
interface IRedemptionDetails {
  ip?: string;
  deviceInfo?: string;
  timestamp?: Date;
}

interface IToken {
  token: string;
  email: string;
  name: string;
  phone: string;
  createdAt: Date;
  expiresAt: Date;
  isRedeemed: boolean;
  redeemedAt?: Date;
  machineId?: string;
  redemptionDetails?: IRedemptionDetails;
}

// --- Config ---
interface AppConfig {
  port: number;
  mongodbURI: string;
  telegramToken: string;
  jwtSecret: string;
  adminChatId: string;
  isProduction: boolean;
  railwayPublicDomain?: string;
}

// --- TokenService ---
interface UserData {
  email: string;
  name: string;
  phone: string;
}

interface ShareLinks {
  whatsapp: string;
  email: string;
}

interface ClientInfo {
  ip: string;
  deviceInfo?: string;
}

type ValidationResult =
  | { success: false; message: string; redeemedAt?: Date }
  | { success: true; message: string; expiresAt: Date };

interface TokenWithRemainingDays extends IToken {
  remainingDays: number;
}

// --- TelegramService ---
interface UserState {
  step: 'email' | 'name' | 'phone';
  data: Partial<UserData>;
}
```

---

## Plan de Migracion por Fases

### Fase 0 — Limpieza y Correccion de Bugs ✅ COMPLETADA (2026-02-27)
> Prerequisito antes de tocar TypeScript

- [x] Eliminar `src/utils/helper.js` (vacio)
- [x] Eliminar `src/controllers/telegramController.js` (codigo muerto)
- [x] Eliminar `src/routes/telegramRoutes.js` (nunca montado)
- [x] Corregir BUG-1: reemplazar `this.fn()` por llamadas directas en tokenService.js
- [x] Corregir BUG-2: implementar `getTotalTokens()` en tokenService.js
- [x] Corregir BUG-3: agregar paginacion real a `getAllTokens(skip, limit)`
- [x] Corregir BUG-4: corregir `telegramService.sendMessage` → `telegramService.bot.sendMessage`
- [x] Corregir BUG-5: corregir campos inexistentes en `sendTokensToTelegram`
- [x] Corregir BUG-6: `req.connection.remoteAddress` → `req.socket.remoteAddress`
- [x] Eliminar dependencias no usadas: `cors`, `nodemailer`, `stripe`, `whatsapp-web.js`
- [x] Corregir DT-10: usar `config.port` en app.js en vez de duplicar

#### Evidencia de cierre Fase 0

| Validacion | Resultado | Referencia |
|------------|-----------|------------|
| Archivos eliminados no existen en arbol | OK | `helper.js`, `telegramController.js`, `telegramRoutes.js` ausentes |
| BUG-1: llamada directa sin `this` | OK | `tokenService.js:52` |
| BUG-2: `getTotalTokens()` implementado | OK | `tokenService.js:114` |
| BUG-3: paginacion `getAllTokens(skip, limit)` | OK | `tokenService.js:102` |
| BUG-4: `telegramService.bot.sendMessage` | OK | `apiController.js:112` |
| BUG-5: campos `name/isRedeemed/remainingDays` | OK | `apiController.js:97` |
| BUG-6: `req.socket.remoteAddress` | OK | `apiController.js:10` |
| `config.port` en app.js | OK | `app.js:8` |
| Dependencias fantasma eliminadas | OK | `package.json:21` — 102 paquetes removidos |
| Sintaxis JS valida post-cambios | OK | `node -c` exitoso en todos los archivos |

#### Pendientes post-Fase 0 (deuda tecnica no bloqueante)

| ID | Descripcion | Archivo | Prioridad | Owner | Target |
|----|-------------|---------|-----------|-------|--------|
| DT-8 | `Token.deleteOne()` directo en callback de Telegram, bypasea tokenService | `telegramService.js:206` | Media | — | Fase 4 (migracion telegramService) |
| DT-9 | `GET /api/tokens` envia tokens a Telegram como side-effect en cada request | `apiController.js:65` | Media | — | Fase 5 (migracion apiController) |
| DT-11 | Script importTokens usa fallback de 90 dias fijos en vez de logica "primer dia del mes siguiente" | `scripts/importTokens.js:87` | Baja | — | Fase 7 (migracion scripts) |
| — | No hay suite de tests (placeholder en package.json) | `package.json:9` | Baja | — | Post-migracion |

### Fase 1 — Setup TypeScript ✅ COMPLETADA (2026-02-27)
> Infraestructura de compilacion

- [x] Instalar `typescript`, `tsx`, `@types/node`, `@types/express`, `@types/jsonwebtoken`, `@types/node-telegram-bot-api`
- [x] Crear `tsconfig.json` (strict, allowJs, commonjs, ES2020, outDir dist/)
- [x] Actualizar `package.json` scripts (`build`, `start`, `dev`, `typecheck`)
- [x] Agregar `*.tsbuildinfo` a `.gitignore` (`dist/` ya estaba)
- [x] Verificar que `npm run build` funcione — 30 archivos generados en dist/

#### Evidencia de cierre Fase 1

| Validacion | Resultado | Detalle |
|------------|-----------|---------|
| `npx tsc --noEmit` | OK | TypeScript procesa .js existentes sin errores |
| `npx tsc` (build) | OK | 30 archivos en dist/ (10 .js + 10 .d.ts + 10 .js.map) |
| `node dist/app.js` | OK | Arranque limpio, MongoDB conectado, Telegram activo |
| devDependencies instaladas | OK | 24 paquetes nuevos, 6 @types |

#### Tooling de calidad (agregado en Fase 1)

- [x] ESLint 9 flat config con bloques JS (CommonJS) y TS (strict + type-checking)
- [x] Prettier (.prettierrc): single quotes, trailing commas, 100 chars, 2 spaces
- [x] tsconfig.json reforzado: `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`
- [x] Scripts: `lint`, `lint:fix`, `format`, `format:check`, `check` (gate de calidad)
- [x] Baseline de formato: todos los .js formateados con Prettier
- [x] Pipeline `npm run check` pasa completo (typecheck + lint + format)

| Gate de calidad | Resultado |
|-----------------|-----------|
| `tsc --noEmit` | 0 errores |
| `eslint src/` | 0 errores, 4 warnings menores (catch params, return await) |
| `prettier --check` | Todos los archivos pasan |

### Fase 2 — Config + Model (riesgo bajo) ✅ COMPLETADA (2026-02-28)
> Modulos sin dependencias internas complejas

- [x] Migrar `src/config/config.js` → `config.ts` con interface `AppConfig` + validacion `getRequiredEnv()`
- [x] Migrar `src/config/database.js` → `database.ts`
- [x] Migrar `src/models/tokenModel.js` → `tokenModel.ts` con interfaces `IToken`, `IRedemptionDetails`, `ITokenDocument`
- [x] Compatibilidad CJS: `module.exports` en cada .ts para que los .js existentes sigan funcionando
- [x] Boot test: MongoDB + Telegram inician correctamente con los modulos TS

#### Evidencia de cierre Fase 2

| Validacion | Resultado |
|------------|-----------|
| `tsc --noEmit` | 0 errores |
| `eslint` en 3 archivos TS | 0 errores, 0 warnings |
| `prettier --check` | Todos pasan |
| App boot (tsx src/app.js) | MongoDB OK, Telegram OK |

### Fase 3 — Servicios Core (riesgo alto) ✅ COMPLETADA (2026-02-28)
> Logica de negocio, archivo mas complejo

- [x] Migrar `src/services/tokenService.ts` — 13 funciones exportadas, 6 interfaces/tipos locales (UserData, ShareLinks, ClientInfo, TokenWithShareLinks, TokenWithRemainingDays, ValidationResult)
- [x] Migrar `src/services/authService.ts` — generateToken + verifyToken tipados

### Fase 4 — Telegram (riesgo medio) ✅ COMPLETADA (2026-02-28)
> Clase singleton con estado conversacional

- [x] Migrar `src/services/telegramService.ts` — clase TelegramService tipada, `userStates: Map<number, UserState>`, callbacks con `TelegramBot.Message` y `TelegramBot.CallbackQuery`, handlers refactorizados para ESLint no-misused-promises

### Fase 5 — Controllers + Routes (riesgo medio) ✅ COMPLETADA (2026-02-28)
> Capa HTTP

- [x] Migrar `src/controllers/apiController.ts` — handlers tipados `(req: Request, res: Response): Promise<void>`, guard para adminChatId undefined
- [x] Migrar `src/routes/apiRoutes.ts` — Router tipado con ES imports

### Fase 6 — Entry Point (riesgo bajo) ✅ COMPLETADA (2026-02-28)
> Glue code

- [x] Migrar `src/app.ts` — ES imports, startServer tipado
- [x] package.json actualizado: `dev` → `tsx watch src/app.ts`, `main` → `dist/app.js`

### Fase 7 — Scripts (riesgo bajo, independientes) ✅ COMPLETADA (2026-02-28)
> Utilidades standalone

- [x] Migrar `src/scripts/exportTokens.ts` — interface ExcelExportRow, formatDate tipado
- [x] Migrar `src/scripts/importTokens.ts` — interfaces ExcelRow, ImportResults, TokenUpdateFields
- [x] Migrar `src/scripts/deleteDatabase.ts` — readline refactorizado a Promise

### Limpieza post-migracion ✅ COMPLETADA (2026-02-28)

- [x] Eliminados bloques `module.exports` de compatibilidad CJS de 6 archivos
- [x] `allowJs: false` en tsconfig.json
- [x] 0 archivos .js en src/, 12 archivos .ts

#### Evidencia de cierre Fases 3-7

| Validacion | Resultado |
|------------|-----------|
| `tsc --noEmit` | 0 errores |
| `eslint src/` | 0 errores, 2 warnings (non-null assertion en authService — aceptable) |
| `prettier --check` | Todos los archivos pasan |
| Archivos .js en src/ | 0 |
| Archivos .ts en src/ | 12 |

---

## Configuracion Target

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "moduleResolution": "node",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### package.json scripts (target)

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/app.js",
    "dev": "tsx watch src/app.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

### Railway Deploy

- **Build command**: `npm install && npm run build`
- **Start command**: `npm start` → `node dist/app.js`
- Sin cambios en variables de entorno ni webhook paths

---

## Estrategia de Autenticacion API

Los endpoints de la API REST siguen una estrategia mixta: los endpoints consumidos maquina-a-servidor por la app de licencias (EXPEDIENTES-IKE) son publicos, mientras que los endpoints administrativos requieren JWT.

| Endpoint | Metodo | Auth | Uso |
|----------|--------|------|-----|
| `/api/status` | GET | Publico | Health check |
| `/api/login` | POST | Publico (body: `adminKey`) | Obtener JWT admin (24h) |
| `/api/validate` | POST | Publico | Validar/redimir token (maquina-a-servidor) |
| `/api/check-validity/:token` | GET | Publico | Verificar validez sin redimir (maquina-a-servidor) |
| `/api/tokens` | GET | JWT (`Authorization: Bearer <token>`) | Listar tokens (admin) |

El middleware `authenticate` (`src/middleware/authMiddleware.ts`) verifica el header `Authorization: Bearer <JWT>` y decodifica el token usando `authService.verifyToken()`. Solo se aplica a los endpoints marcados como protegidos.

`JWT_SECRET` se carga con `getLazyRequiredEnv` en `config.ts` para que los scripts standalone (export/import/delete) no fallen por falta de esta variable.

---

## Grafo de Dependencias Internas

```
app.ts
├── config/database.ts ─── config/config.ts
├── routes/apiRoutes.ts
│   └── controllers/apiController.ts
│       ├── services/tokenService.ts ─── models/tokenModel.ts
│       └── services/telegramService.ts
├── services/telegramService.ts
│   ├── services/tokenService.ts
│   ├── models/tokenModel.ts
│   └── config/config.ts
└── config/config.ts

scripts/* (standalone)
├── models/tokenModel.ts
└── config/config.ts
```

---

## Orden de Migracion por Dependencias (hojas → raiz)

```
1. config/config.ts          (sin deps internas)
2. models/tokenModel.ts      (sin deps internas)
3. config/database.ts        (depende de config)
4. services/authService.ts   (depende de config)
5. services/tokenService.ts  (depende de model)
6. services/telegramService.ts (depende de tokenService + model + config)
7. controllers/apiController.ts (depende de services)
8. routes/apiRoutes.ts       (depende de controller)
9. app.ts                    (depende de todo)
10-12. scripts/*             (independientes)
```
