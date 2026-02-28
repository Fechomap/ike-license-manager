---
description: Audita y actualiza el CLAUDE.md del proyecto comparando contra el codigo real
argument-hint: "[seccion a auditar o 'all']"
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, Task
---

# /update-claude - Actualizar CLAUDE.md

Audita y actualiza el archivo CLAUDE.md comparando lo documentado contra el estado real del codigo.

## Objetivo

$ARGUMENTS (si vacio, usar "all")

## Archivo Target

`/Users/jhonvc/NODE HEROKU/LICENSE-MANAGER/CLAUDE.md`

## Proceso

### Paso 1: Leer el CLAUDE.md actual

Leer el archivo completo y extraer todas las afirmaciones verificables:
- Version de la app en package.json
- Dependencias y sus versiones
- Estructura de directorios documentada
- Nombres de archivos, servicios, controladores referenciados
- Comandos npm documentados
- Endpoints API, comandos Telegram

### Paso 2: Verificar contra el codigo real

Lanzar agentes en PARALELO (usar Task tool con subagent_type Explore) para verificar:

```
- package.json -> version, dependencias, scripts
- src/services/ -> lista real de servicios
- src/models/ -> modelos reales
- src/controllers/ -> controladores reales
- src/routes/ -> rutas y endpoints reales
- src/config/ -> configuracion real
- src/scripts/ -> scripts reales
- .env.example -> variables de entorno reales
```

### Paso 3: Generar reporte de diferencias

Mostrar al usuario:

```
================================================================
AUDITORIA CLAUDE.md
================================================================

DESACTUALIZADOS (requieren correccion):
  X [item]: documentado [valor] -> real [valor]

CORRECTOS (sin cambios):
  V [item verificado]

NUEVOS (no documentados):
  ! [elemento encontrado en codigo pero no documentado]

ELIMINADOS (documentados pero ya no existen):
  - [listar si hay]

================================================================
```

### Paso 4: Pedir confirmacion

Mostrar las ediciones propuestas y pedir confirmacion ANTES de aplicar.

### Paso 5: Aplicar correcciones

Usar Edit tool para actualizar SOLO las secciones que cambiaron.
NO reescribir el archivo completo. Editar quirurgicamente.

## Reglas

1. **NUNCA** inventar informacion. Solo documentar lo que se verifica en el codigo
2. **NUNCA** borrar secciones de patrones/reglas/convenciones (esas son decisiones humanas)
3. **SOLO** actualizar datos factuales: versiones, listas, estructuras, nombres
4. **MANTENER** el formato y estilo existente del CLAUDE.md
5. **REPORTAR** pero no corregir automaticamente: rutas absolutas que dependen del entorno local
6. Lanzar verificaciones en PARALELO para minimizar tiempo
