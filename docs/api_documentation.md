# IKE License Manager - Documentación de API

## Descripción General

IKE License Manager es un sistema robusto de gestión de licencias de software que proporciona capacidades de generación, validación y administración de tokens a través de una API REST. Esta documentación proporciona información detallada sobre los endpoints disponibles, formatos de solicitud/respuesta y ejemplos de integración. La API está desplegada en Railway.

## URL Base

```
https://tu-dominio.railway.app/api
```

*Nota: Reemplaza `tu-dominio.railway.app` con tu dominio real generado por Railway.*

## Autenticación

Actualmente, la API no requiere autenticación. La implementación planificada incluirá:

- **Autenticación por API Key**: Para comunicaciones servidor a servidor
- **Autenticación JWT**: Para control de acceso basado en usuarios a endpoints de administración

Hasta que se implemente la autenticación, se recomienda tener precaución con los endpoints que modifican datos y considerar la implementación de restricciones de IP a nivel de red.

## Endpoints

### 1. Verificar Estado de la API

Verifica si la API está activa y funcionando correctamente.

**Solicitud**
- Método: `GET`
- Endpoint: `/status`

**Respuesta**
- Código de Estado: `200 OK`

```json
{
  "message": "API funcionando correctamente"
}
```

### 2. Validar y Activar Token

Valida un token y lo activa vinculándolo a un dispositivo específico.

**Solicitud**
- Método: `POST`
- Endpoint: `/validate`
- Content-Type: `application/json`

**Cuerpo de la Solicitud**
```json
{
  "token": "ad1c6c6f6f881d8637306efa48922ff4",
  "machineId": "machine-12345",
  "deviceInfo": "iPhone 14 Pro, iOS 17"  // Opcional
}
```

**Respuesta Exitosa** (200 OK)
```json
{
  "success": true,
  "message": "Token validado y activado correctamente",
  "expiresAt": "2025-02-19T14:42:55.275Z",
  "daysRemaining": 30
}
```

**Respuestas de Error**

Parámetros Faltantes (400 Bad Request)
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
  "error": "Detalles del mensaje de error" // Solo en entornos de desarrollo
}
```

### 3. Listar Todos los Tokens

Recupera una lista de todos los tokens registrados y su estado actual.

**Solicitud**
- Método: `GET`
- Endpoint: `/tokens`
- Parámetros de Consulta:
  - `page`: Número de página (predeterminado: 1)
  - `limit`: Elementos por página (predeterminado: 5, máximo: 100)

**Respuesta** (200 OK)
```json
{
  "tokens": [
    {
      "token": "ad1c6c6f6f881d8637306efa48922ff4",
      "email": "usuario@ejemplo.com",
      "name": "Juan Pérez",
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
      "daysRemaining": 30
    },
    {
      "token": "ad59e4c476e47ed21180e0d540564b7c",
      "email": "otro@ejemplo.com",
      "name": "María García",
      "phone": "+9876543210",
      "createdAt": "2023-12-01T09:15:00.000Z",
      "expiresAt": "2024-03-01T09:15:00.000Z",
      "isRedeemed": false,
      "daysRemaining": 60
    }
  ],
  "currentPage": 1,
  "totalPages": 5,
  "totalTokens": 25
}
```

**Respuesta de Error** (500 Internal Server Error)
```json
{
  "success": false,
  "message": "Error al obtener tokens"
}
```

### 4. Verificar Validez del Token

Verifica si un token es válido sin canjearlo.

**Solicitud**
- Método: `GET`
- Endpoint: `/check-validity/:token`

**Respuesta Exitosa** (200 OK)
```json
{
  "isActive": true
}
```

**Respuesta de Token Inválido o Error** (200 OK con resultado falso)
```json
{
  "isActive": false
}
```

## Ejemplos de Integración

### Ejemplos con cURL

#### Verificar Estado de la API
```bash
curl -X GET https://tu-dominio.railway.app/api/status
```

#### Validar Token
```bash
curl -X POST https://tu-dominio.railway.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"token": "ad1c6c6f6f881d8637306efa48922ff4", "machineId": "machine-12345", "deviceInfo": "MacBook Pro, macOS 12.5"}'
```

#### Listar Tokens
```bash
curl -X GET https://tu-dominio.railway.app/api/tokens
```

#### Verificar Validez del Token
```bash
curl -X GET https://tu-dominio.railway.app/api/check-validity/ad1c6c6f6f881d8637306efa48922ff4
```

### JavaScript (Node.js con Axios)

```javascript
const axios = require('axios');

const API_BASE_URL = 'https://tu-dominio.railway.app/api';

// Verificar Estado de la API
async function verificarEstadoAPI() {
  try {
    const response = await axios.get(`${API_BASE_URL}/status`);
    console.log('Estado de la API:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error al verificar estado de la API:', error.response?.data || error.message);
    throw error;
  }
}

// Validar Token
async function validarToken(token, machineId, deviceInfo) {
  try {
    const response = await axios.post(`${API_BASE_URL}/validate`, {
      token,
      machineId,
      deviceInfo
    });
    console.log('Resultado de validación del token:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error de validación del token:', error.response?.data || error.message);
    throw error;
  }
}

// Listar Todos los Tokens (con paginación)
async function listarTokens(page = 1) {
  try {
    const response = await axios.get(`${API_BASE_URL}/tokens`, {
      params: { page }
    });
    console.log('Lista de tokens:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error al listar tokens:', error.response?.data || error.message);
    throw error;
  }
}

// Verificar validez del token sin canjearlo
async function verificarValidezToken(token) {
  try {
    const response = await axios.get(`${API_BASE_URL}/check-validity/${token}`);
    console.log('Validez del token:', response.data);
    return response.data.isActive;
  } catch (error) {
    console.error('Error al verificar validez del token:', error.response?.data || error.message);
    return false;
  }
}
```

### Python (con requests)

```python
import requests

API_BASE_URL = 'https://tu-dominio.railway.app/api'

def verificar_estado_api():
    try:
        response = requests.get(f'{API_BASE_URL}/status')
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'Error al verificar estado de la API: {e}')
        return None

def validar_token(token, machine_id, device_info=None):
    try:
        payload = {
            'token': token,
            'machineId': machine_id,
            'deviceInfo': device_info
        }
        response = requests.post(f'{API_BASE_URL}/validate', json=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'Error al validar token: {e}')
        return None

def listar_tokens(pagina=1):
    try:
        params = {'page': pagina}
        response = requests.get(f'{API_BASE_URL}/tokens', params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'Error al listar tokens: {e}')
        return None

def verificar_validez_token(token):
    try:
        response = requests.get(f'{API_BASE_URL}/check-validity/{token}')
        response.raise_for_status()
        return response.json().get('isActive', False)
    except requests.exceptions.RequestException as e:
        print(f'Error al verificar validez del token: {e}')
        return False
```

## Mejores Prácticas

1. **Manejo de Errores**
   - Implementar siempre un manejo adecuado de errores en tus aplicaciones cliente
   - Verificar los códigos de estado HTTP y manejarlos apropiadamente
   - Analizar los datos de respuesta cuidadosamente para manejar formatos inesperados
   - Implementar lógica de reintento para errores de red transitorios

2. **Consideraciones de Seguridad**
   - Almacenar datos sensibles (tokens, IDs de máquina) de forma segura
   - Implementar SSL/TLS para todas las comunicaciones con la API (Railway lo proporciona por defecto)
   - Considerar la implementación de limitación de tasa en tus aplicaciones cliente
   - No codificar tokens directamente en el código de tu aplicación

3. **Rendimiento**
   - Implementar caché donde sea apropiado
   - Manejar tiempos de espera de red elegantemente
   - Utilizar los parámetros de paginación para listar tokens y evitar cargas grandes

4. **Gestión de Tokens**
   - Almacenar el machineId de forma segura en el dispositivo cliente
   - Implementar mensajes de error apropiados para los usuarios cuando la validación del token falla
   - Considerar la implementación de un flujo de renovación antes de que los tokens expiren

## Límites y Restricciones

- Límite de tasa de API: 100 solicitudes por minuto por dirección IP
- Tamaño máximo de carga útil de solicitud: 1MB
- Los listados de tokens están paginados con un valor predeterminado de 5 elementos por página y un máximo de 100

## Modelo de Datos

El modelo de token incluye los siguientes campos:

```javascript
{
  token: String,          // Identificador único del token
  email: String,          // Correo electrónico del usuario
  name: String,           // Nombre del usuario
  phone: String,          // Número de teléfono del usuario
  createdAt: Date,        // Fecha de creación del token
  expiresAt: Date,        // Fecha de expiración del token
  isRedeemed: Boolean,    // Estado de canje
  redeemedAt: Date,       // Fecha de canje
  machineId: String,      // Identificador único de la máquina
  redemptionDetails: {
    ip: String,           // Dirección IP utilizada para el canje
    deviceInfo: String,   // Información del dispositivo
    timestamp: Date       // Marca de tiempo del canje
  },
  daysRemaining: Number   // Campo calculado: días hasta la expiración
}
```

## Versionado de API

Esta documentación cubre la v1 de la API. Los cambios futuros serán versionados utilizando versionado basado en ruta (por ejemplo, `/api/v2/...`).

## Información de Railway

### Características de Railway

- **HTTPS automático**: Todos los endpoints están disponibles sobre HTTPS
- **Escalabilidad automática**: El servicio se escala según la demanda
- **Monitorización**: Railway proporciona métricas de rendimiento y logs
- **Variables de entorno**: Gestión segura de configuración

### Verificación de Salud

Railway proporciona un endpoint de health check automático. Puedes verificar que tu instancia esté saludable:

```bash
curl https://tu-dominio.railway.app/health
```

## Soporte

Para soporte adicional o para reportar problemas:
- Abrir un issue en el repositorio del proyecto
- Contactar al equipo de desarrollo a través de [correo de soporte]
- Consultar la documentación del proyecto en el repositorio
- Revisar los logs de Railway para diagnóstico

## Registro de Cambios

**v1.0.0 (27/02/2024)**
- Lanzamiento inicial con validación, listado y verificación de estado de tokens
- Implementación de canje de tokens con vinculación a máquina
- Migración de Heroku a Railway

**Características Planificadas**
- Autenticación de usuario para endpoints de gestión de tokens
- API de generación de tokens por lotes
- Informes y análisis mejorados