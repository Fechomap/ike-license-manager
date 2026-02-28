---
paths:
  - "src/app.js"
  - "src/routes/**/*.js"
  - "src/controllers/**/*.js"
---

# Reglas Express API y Rutas

## App Principal (app.js)
- Express server con conexion a MongoDB al iniciar
- Middleware: express.json() para parseo de body
- Rutas montadas en `/api` via apiRoutes
- Webhook de Telegram solo en produccion: `POST /api/telegram-webhook`
- NUNCA agregar rutas directamente en app.js, usar archivos de routes

## Routes
- Un archivo por dominio: apiRoutes (tokens/validacion), telegramRoutes
- Patron: `router.METHOD('/path', controller.metodo)`
- SIEMPRE usar async handlers con try-catch en controllers
- Endpoints actuales: GET /status, POST /validate, GET /tokens, GET /check-validity/:token

## Controllers
- Un controller por dominio: apiController, telegramController
- SOLO parsear request, llamar al service y formatear response
- NUNCA poner logica de negocio en controllers
- Respuesta estandar: `{ success: bool, data: {}, message: "" }`
- Manejo de errores: try-catch con res.status(code).json()

## Middleware
- No hay middleware de autenticacion implementado (authService existe pero no esta integrado)
- CORS importado pero con configuracion default
- Al agregar middleware, registrarlo en app.js ANTES de las rutas
