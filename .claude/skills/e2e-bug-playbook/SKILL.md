---
name: e2e-bug-playbook
description: |
  Playbook de investigacion profunda de bugs para LICENSE-MANAGER.
  USAR cuando haya comportamiento incorrecto, errores intermitentes o regresiones,
  y se necesite RCA con evidencia end-to-end antes de corregir.
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Task, mcp__playwright__*
---

# E2E Bug Playbook

Usar este flujo para aislar causa raiz real y evitar fixes por intuicion.

## Evidencia Minima Requerida

1. Pasos de reproduccion exactos.
2. Flujo completo con `archivo:linea`.
3. Evidencia tecnica (logs, salida de comandos, comportamiento observado).
4. Explicacion de causa raiz.

## Flujo de Investigacion

### 1) Intake
- Capturar: trigger, esperado, observado, frecuencia, entorno.
- Definir impacto (bloqueante, alto, medio, bajo).
- Identificar canal: API REST, Telegram bot, o script.

### 2) Mapeo end-to-end
- Seguir ruta: Route -> Controller -> Service -> Model -> MongoDB.
- Para Telegram: Comando -> telegramService handler -> tokenService -> Model.
- Arbol de llamadas: incluir funciones anidadas.

### 3) Reproduccion controlada
- Repro con curl para API o comandos Telegram para bot.
- Crear matriz:
  - entorno
  - paso
  - resultado esperado
  - resultado observado

### 4) Instrumentacion quirurgica
- Agregar logs con prefijo `[BUG-INVESTIGATION]`.
- Log en entrada/salida, decisiones, errores y eventos.
- No loggear tokens completos, credenciales MongoDB o JWT secrets.

### 5) RCA
- Encontrar primer punto de divergencia.
- Responder:
  - que valor/estado rompe el flujo
  - por que se llega ahi
  - por que esto explica el sintoma

### 6) Plan de fix
- Proponer cambios minimos por archivo.
- Definir pruebas de no-regresion.
- Esperar aprobacion antes de implementar.

### 7) Verificacion
- Repetir caso original.
- Probar 1-2 rutas colaterales.
- Limpiar logs temporales.

## Anti-Patrones

- "No pude reproducir, pero debe ser X".
- Hotfix sin prueba que descarte otras hipotesis.
- Validacion en capa incorrecta para esconder error.
- Cerrar investigacion sin evidencia de reproducibilidad.

## Template de Reporte

```markdown
# RCA

## Contexto
- bug:
- entorno:

## Reproduccion
- pasos:
- resultado:

## Flujo E2E
- [archivo:linea] -> [archivo:linea] -> ...

## Evidencia
- logs:
- comandos:

## Causa Raiz
- ...

## Plan de Correccion
1. ...
2. ...

## Verificacion
- escenario original:
- regresion:
```
