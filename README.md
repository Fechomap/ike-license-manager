# IKE License Manager

Sistema de gestion de licencias con bot de Telegram y API REST para la validacion y administracion de tokens. Proyecto TypeScript desplegado en Railway con MongoDB Atlas.

## Caracteristicas Principales

- Generacion y gestion de tokens de licencia
- Bot de Telegram para administracion
- API REST para validacion de licencias
- Sistema de importacion/exportacion de datos (Excel)
- Sistema de redencion unica por token
- Vinculacion de licencias a maquinas especificas
- Autenticacion JWT para endpoints administrativos

## Requisitos Previos

- Node.js (v16 o superior)
- MongoDB
- Token de Bot de Telegram
- Variables de entorno configuradas
- Cuenta en Railway (para deployment)

## Instalacion

1. Clonar el repositorio:
```bash
git clone <repository-url>
cd ike-license-manager
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
```

Editar el archivo `.env` con tus configuraciones:
```env
PORT=3000
MONGODB_URI=mongodb://localhost/ike-license
TELEGRAM_TOKEN=your_telegram_bot_token
JWT_SECRET=your_jwt_secret
ADMIN_CHAT_ID=your_admin_chat_id          # ID del chat de Telegram del administrador (usado por el bot)
ADMIN_API_KEY=tu_clave_admin_segura_aqui   # Clave para POST /login (fallback temporal: ADMIN_CHAT_ID)
NODE_ENV=production # Para entorno Railway
RAILWAY_ENVIRONMENT_NAME=production # Configuracion de Railway
RAILWAY_PUBLIC_DOMAIN=tu-dominio.railway.app # Solo para Railway
```

## Comandos

```bash
npm run dev        # Desarrollo con hot-reload (tsx watch src/app.ts)
npm run build      # Compila TypeScript a dist/ (tsc)
npm start          # Inicia el servidor compilado (node dist/app.js)
npm run typecheck  # Verificacion de tipos (tsc --noEmit)
npm run lint       # Lint con ESLint
npm run format     # Formateo con Prettier
npm run check      # Gate de calidad: typecheck + lint + format:check
```

Scripts de datos (ejecutar directamente):
```bash
npx tsx src/scripts/exportTokens.ts   # Exporta tokens a Excel
npx tsx src/scripts/importTokens.ts   # Importa tokens desde Excel
npx tsx src/scripts/deleteDatabase.ts # Elimina la base de datos
```

## Deployment en Railway

### Configuracion inicial

1. Conecta tu repositorio a Railway
2. Configura las variables de entorno:
   - `MONGODB_URI`: Tu cadena de conexion a MongoDB
   - `TELEGRAM_TOKEN`: Token de tu bot de Telegram
   - `JWT_SECRET`: Clave secreta para JWT
   - `ADMIN_CHAT_ID`: ID del chat de Telegram del administrador (usado por el bot)
   - `ADMIN_API_KEY`: Clave para autenticacion API via `POST /login`
   - `NODE_ENV`: production

3. Railway generara automaticamente:
   - `RAILWAY_PUBLIC_DOMAIN`: Dominio publico de tu aplicacion
   - `RAILWAY_ENVIRONMENT_NAME`: Nombre del entorno

4. Build y start commands:
   - **Build**: `npm install && npm run build`
   - **Start**: `npm start` (ejecuta `node dist/app.js`)

### Verificacion del deployment

1. Verifica que la aplicacion se despliega correctamente:
```bash
curl https://tu-dominio.railway.app/api/status
```

2. El webhook del bot de Telegram se configura automaticamente al iniciar.

## API Endpoints

### Base URL
```
https://tu-dominio.railway.app/api
```

### Autenticacion

Los endpoints de la API siguen una estrategia mixta:
- **Endpoints publicos**: consumidos maquina-a-servidor por la app de licencias, no requieren autenticacion.
- **Endpoints administrativos**: requieren un JWT obtenido via `POST /api/login`.

Para obtener un JWT:
```bash
curl -X POST https://tu-dominio.railway.app/api/login \
  -H "Content-Type: application/json" \
  -d '{"adminKey": "tu_admin_api_key"}'
```

> **Nota:** `adminKey` se valida contra `ADMIN_API_KEY`. Si `ADMIN_API_KEY` no esta configurada, se usa `ADMIN_CHAT_ID` como fallback temporal (deprecated).

Respuesta:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

El token tiene una validez de 24 horas. Usarlo en endpoints protegidos con el header:
```
Authorization: Bearer <token>
```

### Endpoints

1. **Estado del Servicio** (publico)
```http
GET /status
```

2. **Login Admin** (publico)
```http
POST /login
Content-Type: application/json

{
    "adminKey": "tu_admin_api_key"
}
```

3. **Validar Token** (publico)
```http
POST /validate
Content-Type: application/json

{
    "token": "string",
    "machineId": "string",
    "deviceInfo": "string"
}
```

4. **Verificar Validez** (publico)
```http
GET /check-validity/:token
```

5. **Listar Tokens** (protegido, requiere JWT)
```http
GET /tokens?page=1
Authorization: Bearer <token>
```

## Comandos del Bot de Telegram

- `/start` - Iniciar el bot
- `/help` - Mostrar comandos disponibles
- `/generar_token` - Generar nuevo token
- `/listar_tokens` - Listar tokens existentes
- `/tokens_caducando` - Mostrar tokens proximos a expirar
- `/tokens_expirados` - Listar tokens expirados

## Estructura del Proyecto

```
IKE-LICENSE-MANAGER/
├── docs/
│   └── api_documentation.md
├── src/
│   ├── config/
│   │   ├── config.ts
│   │   └── database.ts
│   ├── controllers/
│   │   └── apiController.ts
│   ├── middleware/
│   │   └── authMiddleware.ts
│   ├── models/
│   │   └── tokenModel.ts
│   ├── routes/
│   │   └── apiRoutes.ts
│   ├── services/
│   │   ├── authService.ts
│   │   ├── telegramService.ts
│   │   └── tokenService.ts
│   ├── scripts/
│   │   ├── exportTokens.ts
│   │   ├── importTokens.ts
│   │   └── deleteDatabase.ts
│   └── app.ts
├── CLAUDE.md
├── MIGRATION-TO-TYPESCRIPT.md
└── package.json
```

## Modelo de Datos

### Token
```typescript
{
    token: string;          // Identificador unico (hex 32 chars)
    email: string;          // Email del usuario
    name: string;           // Nombre del usuario
    phone: string;          // Telefono
    createdAt: Date;        // Fecha de creacion
    expiresAt: Date;        // Fecha de expiracion (1er dia del mes siguiente)
    isRedeemed: boolean;    // Estado de redencion
    redeemedAt?: Date;      // Fecha de redencion
    machineId?: string;     // ID de maquina
    redemptionDetails?: {
        ip: string;         // IP de redencion
        deviceInfo: string; // Info del dispositivo
        timestamp: Date;    // Timestamp de redencion
    }
}
```

## Mantenimiento

### Logs
Los logs del sistema incluyen:
- Generacion de tokens
- Validaciones de tokens
- Errores de sistema
- Actividad del bot de Telegram

### Acceso a logs en Railway
```bash
railway logs
```

### Backups
Se recomienda:
- Realizar backups diarios de la base de datos
- Exportar regularmente la base de datos usando el script de exportacion
- Mantener copias de seguridad en multiples ubicaciones

## Troubleshooting

### Problemas comunes en Railway

1. **Bot no responde**: Verifica que `RAILWAY_PUBLIC_DOMAIN` esta configurado
2. **Errores de conexion MongoDB**: Asegurate que `MONGODB_URI` esta correctamente configurado
3. **Webhook no funciona**: Verifica que el servicio esta corriendo en HTTPS

### Verificar estado del servicio

```bash
curl https://tu-dominio.railway.app/api/status
```

## Licencia

Este proyecto esta bajo la licencia ISC. Ver el archivo `LICENSE` para mas detalles.
