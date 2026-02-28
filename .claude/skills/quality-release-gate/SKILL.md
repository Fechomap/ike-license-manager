---
name: quality-release-gate
description: |
  Skill de auditoria de calidad para LICENSE-MANAGER.
  USAR antes de merge/release y despues de bug fixes para evaluar severidad,
  riesgo de regresion, seguridad y readiness con decision GO/NO-GO.
allowed-tools: Read, Grep, Glob, Bash
---

# Quality Release Gate

Aplicar esta skill para emitir un veredicto tecnico con evidencia.

## Rubrica de Severidad

- `P0` Bloquea release (flujo principal roto, perdida de datos o riesgo de seguridad).
- `P1` Alto impacto con regresion probable en flujo core.
- `P2` Riesgo medio, workaround posible.
- `P3` Mejora o deuda menor.

## Flujo de Auditoria

### 1) Inspeccion de cambios
- Revisar diff y archivos afectados.
- Identificar alcance directo e indirecto.

### 2) Auditoria tecnica
- Routes: endpoints correctos, metodos HTTP.
- Controllers: sin logica de negocio, respuestas HTTP estandarizadas.
- Services: validaciones, logica de tokens, estado bot Telegram.
- Models: schema Mongoose, validaciones, indices.
- Seguridad: no exponer credenciales, tokens, MongoDB URI.

### 3) Pruebas minimas
- Ejecutar smoke run de app (`npm run dev`).
- Verificar endpoint `/api/status`.
- Confirmar que bot Telegram responde.

### 4) Decision
- `GO` solo sin P0/P1 abiertos y con evidencia suficiente.
- `NO-GO` si falta evidencia o hay riesgos altos sin mitigacion.

## Senales Tipicas de Parche

- Condicional ad-hoc sin resolver origen del problema.
- Duplicacion para evitar tocar logica base.
- "quick fix" sin pruebas de regresion.
- Validacion puesta lejos del origen de falla.

## Formato de Salida

```markdown
# Quality Gate

## Findings
### [P0|P1|P2|P3] Titulo
- evidencia:
- impacto:
- accion:

## Riesgos Residuales
- ...

## Veredicto
- Decision: GO | NO-GO
- Condiciones para GO:
```
