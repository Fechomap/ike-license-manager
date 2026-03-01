# Requerimiento: Mejora del Contrato API de Licencias

**Fecha:** 2026-02-28
**Solicitante:** Equipo IKE Expedientes (app de escritorio)
**Dirigido a:** Equipo de backend de licencias (HAVANI)

---

## Contexto

La aplicacion de escritorio IKE Expedientes valida licencias contra el servidor mediante dos endpoints principales:

- `POST /api/validate` — Validacion inicial de un token nuevo
- `GET /api/check-validity/{token}` — Re-validacion de un token existente

Actualmente, la respuesta del servidor es binaria: `valid: true/false` con un `message` opcional. Esto impide que la aplicacion muestre informacion util al usuario cuando su licencia no esta activa.

## Problema

Cuando el servidor rechaza una licencia, la app solo sabe que "no es valida". No puede distinguir entre:

- Licencia **expirada** por fecha de vencimiento
- Licencia **suspendida** por falta de pago
- Licencia **revocada** administrativamente
- Licencia **cancelada** por el usuario

Tampoco puede mostrar la **fecha real de vencimiento** porque el endpoint `GET /api/check-validity/{token}` no siempre la devuelve (a veces retorna solo un booleano `true`).

## Respuesta actual del servidor

### GET /api/check-validity/{token}

Puede retornar 3 formatos distintos:

```
// Formato 1: booleano literal
true

// Formato 2: objeto con campos
{ "valid": true, "expiresAt": "2026-03-15T00:00:00Z", "permissions": [] }

// Formato 3: rechazo
{ "valid": false, "message": "Token expirado" }
```

### Lo que falta

No hay campo `status` ni `reason`. El campo `expiresAt` es opcional y no siempre viene. El `message` es un texto libre sin estructura.

---

## Requerimiento

### 1. Campo `status` (CRITICO)

Agregar un campo `status` en la respuesta de `GET /api/check-validity/{token}` con valores estandarizados:

| Valor | Descripcion |
|-------|-------------|
| `active` | Licencia activa y vigente |
| `expired` | Vencio la fecha de vigencia |
| `suspended` | Suspendida por falta de pago |
| `revoked` | Revocada administrativamente |
| `cancelled` | Cancelada |

### 2. Campo `expiresAt` obligatorio (CRITICO)

El campo `expiresAt` debe venir **siempre** en la respuesta cuando la licencia existe, independientemente del estado. Formato ISO 8601.

### 3. Respuesta estandarizada (IMPORTANTE)

Que el endpoint **siempre** retorne un objeto JSON, nunca un booleano literal. Propuesta:

```json
{
  "valid": true,
  "status": "active",
  "expiresAt": "2026-06-15T00:00:00Z",
  "permissions": ["basic"],
  "message": "Licencia activa"
}
```

Cuando no es valida:

```json
{
  "valid": false,
  "status": "suspended",
  "expiresAt": "2026-02-15T00:00:00Z",
  "reason": "Falta de pago",
  "message": "Licencia suspendida por falta de pago"
}
```

### 4. Campo `reason` (DESEABLE)

Texto legible con la razon especifica del estado actual. Util para mostrar al usuario final.

---

## Campos opcionales (DESEABLES a futuro)

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `plan` | string | Tipo de plan (basico, premium, etc.) |
| `renewable` | boolean | Si la licencia puede renovarse |
| `ownerName` | string | Nombre del titular |
| `maxDevices` | number | Limite de dispositivos permitidos |
| `currentDevices` | number | Dispositivos registrados actualmente |

---

## Beneficio

Con estos campos, la app podra mostrar al usuario:

- **Suspendida:** "Su licencia esta suspendida por falta de pago. Realice el pago correspondiente."
- **Expirada:** "Su licencia vencio el DD/MM/YYYY. Renueve su licencia."
- **Revocada:** "Su licencia ha sido revocada. Contacte al equipo HAVANI."

En vez del mensaje generico actual: "Su licencia no esta activa."

---

## Impacto en la app

Una vez que el backend implemente estos cambios, la app necesitara:

1. Actualizar `ServerValidationResult` para incluir `status` y `reason`
2. Actualizar la entidad `License` para persistir el `status`
3. Actualizar la UI para mostrar pantallas diferenciadas segun el `status`

Estos cambios en la app son menores (~2 horas) una vez que el contrato API este definido.

---

## Contacto

Para coordinar la implementacion o resolver dudas sobre el contrato, contactar al equipo de desarrollo de IKE Expedientes.
