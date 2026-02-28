---
description: Lanza investigaciones autonomas paralelas sobre un tema en LICENSE-MANAGER
argument-hint: "<tema o pregunta>"
allowed-tools:
  - Task
  - Read
  - Grep
  - Glob
  - Bash
---

# /investigar - Investigaciones Autonomas Paralelas

Lanza multiples agentes que exploran diferentes areas del codebase en paralelo.

## Uso

```
/investigar <tema o pregunta>
```

## Proceso

### Paso 1: Analizar el tema y lanzar agentes

Usar Task tool con estos subagent_type REALES:

| Area | subagent_type | Uso |
|------|---------------|-----|
| Services/Models | `Explore` | Buscar en services, models, config |
| Controllers/Routes | `Explore` | Buscar en controllers, routes, app.js |
| Analisis profundo | `dev-senior` | Cuando necesita razonar sobre arquitectura |

### Paso 2: Lanzar en PARALELO

Usar un SOLO mensaje con multiples Task tool calls. Ejemplo:

```
Task 1 (Explore): "Buscar en services y models: [tema]. Path: /Users/jhonvc/NODE HEROKU/LICENSE-MANAGER/src/. Buscar en services/, models/, config/. Thoroughness: very thorough"

Task 2 (Explore): "Buscar en controllers, routes y app: [tema]. Path: /Users/jhonvc/NODE HEROKU/LICENSE-MANAGER/src/. Buscar en controllers/, routes/, app.js. Thoroughness: very thorough"

Task 3 (Explore): "Buscar en scripts y utils: [tema]. Path: /Users/jhonvc/NODE HEROKU/LICENSE-MANAGER/src/. Buscar en scripts/, utils/. Thoroughness: very thorough"
```

### Paso 3: Consolidar hallazgos

Cuando los agentes terminen, generar reporte:

```
================================================================
REPORTE DE INVESTIGACION: [TEMA]
================================================================

SERVICES (tokenService, telegramService, authService):
- [hallazgos]

MODELS (tokenModel):
- [hallazgos]

CONTROLLERS (apiController, telegramController):
- [hallazgos]

ROUTES (apiRoutes, telegramRoutes):
- [hallazgos]

CONFIG (config.js, database.js):
- [hallazgos]

SCRIPTS (export, import, delete):
- [hallazgos]

ZONAS NO CUBIERTAS:
- [gaps identificados]

SIGUIENTE PASO:
- [accion recomendada]
================================================================
```

### Paso 4: Monitorear

Mientras los agentes trabajan:
1. Esperar a que cada uno termine
2. Si un agente encuentra algo critico (BUG), notificar inmediatamente
3. Si un agente no encuentra nada en 5 minutos, dejarlo terminar

## Configuracion de Seguridad

| Parametro | Valor | Proposito |
|-----------|-------|-----------|
| Agentes maximos | 3 | Evitar sobrecarga de contexto |
| Timeout por agente | 10 min | Evitar loops infinitos |
| Iteraciones por agente | 15 max | Limite de profundidad |
| Modelo | Sonnet | Balance costo/capacidad |

## Cuando NO Usar /investigar

- Para bugs simples con ubicacion conocida -> usar `/debug`
- Para verificar calidad de codigo -> usar `/audit-code`
- Para tareas de implementacion -> usar agente `dev-senior`
- Cuando necesitas control paso a paso -> usar agentes manualmente

## Cuando SI Usar /investigar

- No sabes donde empezar a buscar
- El problema puede estar en multiples capas (API + Telegram + DB)
- Quieres explorar sin invertir tiempo guiando
- Necesitas mapear un flujo completo end-to-end
