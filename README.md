# IKE License Manager

Sistema de gestión de licencias con bot de Telegram y API REST para la validación y administración de tokens.

## Características Principales

- 🔑 Generación y gestión de tokens de licencia
- 🤖 Bot de Telegram para administración
- 🌐 API REST para validación de licencias
- 📊 Sistema de importación/exportación de datos
- 📱 Integración con WhatsApp y Gmail para compartir tokens
- 🔒 Sistema de redención única por token
- 💻 Vinculación de licencias a máquinas específicas

## Requisitos Previos

- Node.js (v14 o superior)
- MongoDB
- Token de Bot de Telegram
- Variables de entorno configuradas

## Instalación

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
ADMIN_CHAT_ID=your_admin_chat_id
```

## Uso

### Iniciar el Servidor

```bash
npm start
```

### Comandos del Bot de Telegram

- `/start` - Iniciar el bot
- `/help` - Mostrar comandos disponibles
- `/generar_token` - Generar nuevo token
- `/listar_tokens` - Listar tokens existentes
- `/tokens_caducando` - Mostrar tokens próximos a expirar
- `/exportar_tokens` - Exportar lista a Excel

### API Endpoints

#### Base URL
```
https://ike-license-manager-9b796c40a448.herokuapp.com/api
```

#### Endpoints Principales

1. **Validar Token**
```http
POST /validate
Content-Type: application/json

{
    "token": "string",
    "machineId": "string",
    "deviceInfo": "string"
}
```

2. **Estado del Servicio**
```http
GET /status
```

3. **Listar Tokens**
```http
GET /tokens
```

### Scripts de Administración

#### Exportar Base de Datos
```bash
node src/scripts/exportTokens.js
```
Genera un archivo Excel con todos los tokens en `src/scripts/data/tokens_database.xlsx`

#### Importar/Actualizar Base de Datos
```bash
node src/scripts/importTokens.js
```
Lee el archivo `tokens_database.xlsx` y actualiza los registros en la base de datos

## Estructura del Proyecto

```
IKE-LICENSE-MANAGER/
├── docs/
│   └── api_documentation.md
├── src/
│   ├── config/
│   │   ├── config.js
│   │   └── database.js
│   ├── controllers/
│   │   ├── apiController.js
│   │   └── telegramController.js
│   ├── models/
│   │   └── tokenModel.js
│   ├── routes/
│   │   ├── apiRoutes.js
│   │   └── telegramRoutes.js
│   ├── services/
│   │   ├── authService.js
│   │   ├── telegramService.js
│   │   └── tokenService.js
│   └── utils/
│       └── helper.js
└── app.js
```

## Modelo de Datos

### Token
```javascript
{
    token: String,          // Identificador único
    email: String,          // Email del usuario
    name: String,           // Nombre del usuario
    phone: String,          // Teléfono
    createdAt: Date,        // Fecha de creación
    expiresAt: Date,        // Fecha de expiración
    isRedeemed: Boolean,    // Estado de redención
    redeemedAt: Date,       // Fecha de redención
    machineId: String,      // ID de máquina
    redemptionDetails: {
        ip: String,         // IP de redención
        deviceInfo: String, // Info del dispositivo
        timestamp: Date     // Timestamp de redención
    }
}
```

## Mejores Prácticas

### Seguridad
- Implementar rate limiting en producción
- Usar HTTPS para todas las comunicaciones
- Proteger endpoints sensibles con autenticación
- Almacenar tokens y datos sensibles de forma segura

### Rendimiento
- Implementar caché donde sea apropiado
- Manejar timeouts de red adecuadamente
- Implementar lógica de reintentos para solicitudes fallidas

## Mantenimiento

### Logs
Los logs del sistema incluyen:
- Generación de tokens
- Validaciones de tokens
- Errores de sistema
- Actividad del bot de Telegram

### Backups
Se recomienda:
- Realizar backups diarios de la base de datos
- Exportar regularmente la base de datos usando el script de exportación
- Mantener copias de seguridad en múltiples ubicaciones

## Soporte

Para soporte técnico o reportar problemas:
1. Revisar la documentación en `/docs`
2. Contactar al equipo de desarrollo
3. Abrir un issue en el repositorio

## Licencia

Este proyecto está bajo la licencia [Your License]. Ver el archivo `LICENSE` para más detalles.