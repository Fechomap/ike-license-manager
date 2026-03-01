# IKE License Manager - Documentacion de API

## Descripcion General

IKE License Manager es un sistema de gestion de licencias de software que proporciona capacidades de generacion, validacion y administracion de tokens a traves de una API REST. Esta documentacion proporciona informacion detallada sobre los endpoints disponibles, formatos de solicitud/respuesta y ejemplos de integracion. La API esta desplegada en Railway.

## URL Base

```
https://tu-dominio.railway.app/api
```

*Nota: Reemplaza `tu-dominio.railway.app` con tu dominio real generado por Railway.*

## Autenticacion

La API utiliza una estrategia mixta de autenticacion:

- **Endpoints publicos**: Los endpoints consumidos maquina-a-servidor (`/validate`, `/check-validity`, `/status`) no requieren autenticacion.
- **Endpoints administrativos**: El endpoint `GET /tokens` requiere un JWT obtenido via `POST /login`.

### Obtener un JWT

Enviar una solicitud `POST /login` con el `adminKey` (valor de `ADMIN_API_KEY` configurado en el servidor):

```bash
curl -X POST https://tu-dominio.railway.app/api/login \
  -H "Content-Type: application/json" \
  -d '{"adminKey": "tu_admin_api_key"}'
```

> **Nota:** Si `ADMIN_API_KEY` no esta configurada, el servidor acepta temporalmente `ADMIN_CHAT_ID` como fallback (deprecated). Se recomienda configurar `ADMIN_API_KEY` lo antes posible.

Respuesta exitosa:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

El token JWT tiene una validez de **24 horas**. Para usar endpoints protegidos, incluir el header:
```
Authorization: Bearer <token>
```

## Endpoints

### 1. Verificar Estado de la API

Verifica si la API esta activa y funcionando correctamente.

**Solicitud**
- Metodo: `GET`
- Endpoint: `/status`
- Auth: Publico

**Respuesta** (200 OK)
```json
{
  "status": "API is running",
  "timestamp": "2026-02-28T12:00:00.000Z"
}
```

### 2. Login Admin

Obtiene un JWT para acceder a endpoints protegidos.

**Solicitud**
- Metodo: `POST`
- Endpoint: `/login`
- Content-Type: `application/json`
- Auth: Publico

**Cuerpo de la Solicitud**
```json
{
  "adminKey": "tu_admin_api_key"
}
```

> `adminKey` se valida contra la variable de entorno `ADMIN_API_KEY`. Temporalmente se acepta `ADMIN_CHAT_ID` como fallback si `ADMIN_API_KEY` no esta definida.

**Respuesta Exitosa** (200 OK)
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Respuesta de Error**

Credenciales invalidas (401 Unauthorized)
```json
{
  "success": false,
  "message": "Credenciales invalidas"
}
```

Error del Servidor (500 Internal Server Error)
```json
{
  "success": false,
  "message": "Error al generar token"
}
```

### 3. Validar y Activar Token

Valida un token y lo activa vinculandolo a un dispositivo especifico.

**Solicitud**
- Metodo: `POST`
- Endpoint: `/validate`
- Content-Type: `application/json`
- Auth: Publico

**Cuerpo de la Solicitud**
```json
{
  "token": "ad1c6c6f6f881d8637306efa48922ff4",
  "machineId": "machine-12345",
  "deviceInfo": "iPhone 14 Pro, iOS 17"
}
```

**Respuesta Exitosa** (200 OK)
```json
{
  "success": true,
  "message": "Token validado y activado correctamente",
  "expiresAt": "2025-02-19T14:42:55.275Z"
}
```

**Respuestas de Error**

Parametros Faltantes (400 Bad Request)
```json
{
  "success": false,
  "message": "Token y machineId son requeridos"
}
```

Token No Encontrado (404 Not Found)
```json
{
  "success": false,
  "message": "Token no encontrado"
}
```

Token Ya Canjeado (400 Bad Request)
```json
{
  "success": false,
  "message": "Token ya ha sido utilizado",
  "redeemedAt": "2023-12-15T10:30:00.000Z"
}
```

Token Expirado (400 Bad Request)
```json
{
  "success": false,
  "message": "Token expirado"
}
```

Error del Servidor (500 Internal Server Error)
```json
{
  "success": false,
  "message": "Error al validar el token",
  "error": "Detalles del mensaje de error"
}
```

### 4. Listar Todos los Tokens

Recupera una lista de todos los tokens registrados y su estado actual.

**Solicitud**
- Metodo: `GET`
- Endpoint: `/tokens`
- Auth: Requiere JWT (`Authorization: Bearer <token>`)
- Parametros de Consulta:
  - `page`: Numero de pagina (predeterminado: 1)

**Respuesta** (200 OK)
```json
{
  "tokens": [
    {
      "token": "ad1c6c6f6f881d8637306efa48922ff4",
      "email": "usuario@ejemplo.com",
      "name": "Juan Perez",
      "phone": "+1234567890",
      "createdAt": "2023-11-15T10:30:00.000Z",
      "expiresAt": "2024-02-15T10:30:00.000Z",
      "isRedeemed": true,
      "redeemedAt": "2023-11-16T14:22:00.000Z",
      "machineId": "machine-12345",
      "redemptionDetails": {
        "ip": "192.168.1.10",
        "deviceInfo": "iPhone 14 Pro, iOS 17",
        "timestamp": "2023-11-16T14:22:00.000Z"
      },
      "remainingDays": 30
    }
  ],
  "currentPage": 1,
  "totalPages": 5
}
```

**Respuestas de Error**

No autorizado (401 Unauthorized)
```json
{
  "success": false,
  "message": "Token de autorizacion requerido"
}
```

Token JWT invalido (401 Unauthorized)
```json
{
  "success": false,
  "message": "Token invalido o expirado"
}
```

Error del Servidor (500 Internal Server Error)
```json
{
  "success": false,
  "message": "Error al obtener tokens"
}
```

### 5. Verificar Validez del Token

Verifica si un token es valido sin canjearlo.

**Solicitud**
- Metodo: `GET`
- Endpoint: `/check-validity/:token`
- Auth: Publico

**Respuesta** (200 OK)
```json
true
```

**Respuesta de Token Invalido o Error** (200 OK)
```json
false
```

## Ejemplos de Integracion

### Ejemplos con cURL

#### Verificar Estado de la API
```bash
curl -X GET https://tu-dominio.railway.app/api/status
```

#### Obtener JWT Admin
```bash
curl -X POST https://tu-dominio.railway.app/api/login \
  -H "Content-Type: application/json" \
  -d '{"adminKey": "tu_admin_api_key"}'
```

#### Validar Token
```bash
curl -X POST https://tu-dominio.railway.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"token": "ad1c6c6f6f881d8637306efa48922ff4", "machineId": "machine-12345", "deviceInfo": "MacBook Pro, macOS 12.5"}'
```

#### Listar Tokens (requiere JWT)
```bash
curl -X GET https://tu-dominio.railway.app/api/tokens \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

#### Verificar Validez del Token
```bash
curl -X GET https://tu-dominio.railway.app/api/check-validity/ad1c6c6f6f881d8637306efa48922ff4
```

### JavaScript (Node.js con fetch)

```typescript
const API_BASE_URL = 'https://tu-dominio.railway.app/api';

// Obtener JWT
async function login(adminKey: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.message);
  return data.token;
}

// Listar Tokens (con JWT)
async function listarTokens(jwtToken: string, page = 1) {
  const response = await fetch(`${API_BASE_URL}/tokens?page=${page}`, {
    headers: { Authorization: `Bearer ${jwtToken}` },
  });
  return response.json();
}

// Validar Token
async function validarToken(token: string, machineId: string, deviceInfo?: string) {
  const response = await fetch(`${API_BASE_URL}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, machineId, deviceInfo }),
  });
  return response.json();
}
```

## Mejores Practicas

1. **Manejo de Errores**
   - Implementar siempre un manejo adecuado de errores en tus aplicaciones cliente
   - Verificar los codigos de estado HTTP y manejarlos apropiadamente
   - Implementar logica de reintento para errores de red transitorios

2. **Consideraciones de Seguridad**
   - Almacenar datos sensibles (tokens, IDs de maquina) de forma segura
   - Implementar SSL/TLS para todas las comunicaciones con la API (Railway lo proporciona por defecto)
   - No codificar tokens directamente en el codigo de tu aplicacion
   - Renovar el JWT antes de que expire (validez de 24 horas)

3. **Rendimiento**
   - Implementar cache donde sea apropiado
   - Manejar tiempos de espera de red elegantemente
   - Utilizar los parametros de paginacion para listar tokens y evitar cargas grandes

4. **Gestion de Tokens**
   - Almacenar el machineId de forma segura en el dispositivo cliente
   - Implementar mensajes de error apropiados para los usuarios cuando la validacion del token falla
   - Considerar la implementacion de un flujo de renovacion antes de que los tokens expiren

## Modelo de Datos

El modelo de token incluye los siguientes campos:

```typescript
{
  token: string;          // Identificador unico del token (hex 32 chars)
  email: string;          // Correo electronico del usuario
  name: string;           // Nombre del usuario
  phone: string;          // Numero de telefono del usuario
  createdAt: Date;        // Fecha de creacion del token
  expiresAt: Date;        // Fecha de expiracion (1er dia del mes siguiente)
  isRedeemed: boolean;    // Estado de canje
  redeemedAt?: Date;      // Fecha de canje
  machineId?: string;     // Identificador unico de la maquina
  redemptionDetails?: {
    ip: string;           // Direccion IP utilizada para el canje
    deviceInfo: string;   // Informacion del dispositivo
    timestamp: Date;      // Marca de tiempo del canje
  }
}
```

## Informacion de Railway

### Caracteristicas de Railway

- **HTTPS automatico**: Todos los endpoints estan disponibles sobre HTTPS
- **Escalabilidad automatica**: El servicio se escala segun la demanda
- **Monitorizacion**: Railway proporciona metricas de rendimiento y logs
- **Variables de entorno**: Gestion segura de configuracion

## Registro de Cambios

**v1.1.0 (2026-02-28)**
- Migracion completa a TypeScript
- Endpoint `POST /login` para obtener JWT admin
- Middleware de autenticacion JWT para `GET /tokens`

**v1.0.0 (2024-02-27)**
- Lanzamiento inicial con validacion, listado y verificacion de estado de tokens
- Implementacion de canje de tokens con vinculacion a maquina
- Migracion de Heroku a Railway
