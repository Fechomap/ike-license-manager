---
name: implementation-guardrails
description: |
  Guardrails de implementacion para LICENSE-MANAGER.
  USAR cuando se hagan features, bug fixes, refactors o migracion a TypeScript
  para mantener coherencia de arquitectura y validacion tecnica antes de entregar.
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Implementation Guardrails

Aplicar este playbook para convertir requerimientos en cambios seguros y mantenibles.

## Referencias Rapidas

Leer solo lo necesario:
- `../../rules/express-api.md` para rutas, controllers y middleware.
- `../../rules/services-models.md` para logica de negocio y BD.
- `../../rules/telegram-bot.md` para el bot de Telegram.

## Flujo de Trabajo

### 1) Delimitar alcance
- Definir que comportamiento cambia y que no debe cambiar.
- Definir criterio de aceptacion observable.

### 2) Mapear impacto
- Seguir flujo `Route -> Controller -> Service -> Model -> MongoDB`.
- Identificar archivos primarios y secundarios.
- Verificar si afecta el bot de Telegram.

### 3) Implementar minimo cambio correcto
- Corregir causa raiz primero.
- Evitar cambios cosmeticos sin valor funcional.
- Mantener convenciones de naming y estructura actual.

### 4) Revisar guardrails tecnicos
- Controllers sin logica de negocio.
- Queries MongoDB via Mongoose (no queries raw).
- Manejo de errores con try-catch y status HTTP apropiados.
- Tokens: logica de expiracion al 1er dia del mes siguiente.
- Telegram: estado conversacional via Map, no romper flujo multi-paso.

### 5) Verificar
- Smoke run minimo: `npm run dev`.
- Confirmar que endpoints responden con curl.
- Confirmar que el bot responde a `/start`.

## Checklist de Entrega

- [ ] Criterios de aceptacion cubiertos.
- [ ] Riesgo de regresion evaluado y reportado.
- [ ] Cambios explicados por archivo.
- [ ] Validacion ejecutada y reportada.

## Formato de Cierre

```markdown
## Implementacion
- objetivo:
- archivos:

## Validacion
- comando:
- resultado:

## Riesgos
- ...
```
