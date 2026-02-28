---
name: project-manager-delivery
description: |
  Skill de project management tecnico para LICENSE-MANAGER.
  USAR para planificar, priorizar y orquestar ejecucion entre agentes con foco en entregables,
  riesgos, dependencias y cierre con criterios de exito verificables.
allowed-tools: Read, Grep, Glob, Bash, Task
---

# Project Manager Delivery

Usar esta skill para convertir objetivos en ejecucion controlada.

## Principios

- Transparencia: estado real por tarea y evidencia.
- Inspeccion: revisar avances y calidad en checkpoints.
- Adaptacion: replanificar ante bloqueos o riesgo alto.

## Flujo

### 1) Definir objetivo
- Redactar objetivo en una frase.
- Definir alcance `in` y `out`.
- Definir criterio de exito verificable.

### 2) Construir backlog
- Partir trabajo por entregables.
- Asignar owner ideal por tipo:
  - investigacion -> bug-detective/investigador-autonomo
  - implementacion -> dev-senior
  - auditoria final -> quality-gate
- Estimar tamano relativo: `S`, `M`, `L`.

### 3) Orquestar ejecucion
- Paralelizar tareas sin dependencia.
- Secuenciar tareas de ruta critica.
- Consolidar hallazgos y actualizar plan.

### 4) Gestionar riesgos
- Mantener registro con probabilidad, impacto y mitigacion.
- Escalar inmediatamente riesgo bloqueante.

### 5) Cerrar entrega
- Confirmar cumplimiento de criterios de exito.
- Listar deuda residual y siguiente paso.

## Plantillas

### Plan
```markdown
## Objetivo
- ...

## Alcance
- In:
- Out:

## Backlog
| Pri | Tarea | Owner | Tamano | Dependencia | Estado |
|-----|-------|-------|--------|-------------|--------|

## Riesgos
| Riesgo | Probabilidad | Impacto | Mitigacion | Owner |
|--------|--------------|---------|------------|-------|
```

### Estado
```markdown
## Estado Ejecutivo
- completado:
- en curso:
- bloqueado:
- siguiente accion:
```
