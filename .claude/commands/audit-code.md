---
description: Audita codigo en busca de problemas, malas practicas y deuda tecnica
argument-hint: "[ruta/al/directorio o archivo]"
allowed-tools: Read, Grep, Glob, Bash
context: fork
agent: Explore
---

# Auditoria de Codigo - LICENSE-MANAGER

Realiza una auditoria del codigo en: **$ARGUMENTS**

Si no se especifica ruta, auditar `src/` completo.

## Que Buscar

### 1. Anti-Patrones Criticos

**Arquitectura**
- Logica de negocio en controllers (debe estar en services)
- Queries directas a MongoDB en controllers (debe ir via models/services)
- Servicios con dependencias hardcodeadas

**Node.js / Express**
- try-catch vacios que oculten errores
- Callbacks anidados en vez de async/await
- Memory leaks: listeners no removidos, conexiones DB no cerradas
- Respuestas HTTP sin status code apropiado

**Seguridad**
- Secrets hardcodeados (API keys, tokens, URIs de MongoDB)
- Endpoints sin validacion de input
- Inyeccion NoSQL en queries Mongoose
- CORS mal configurado

### 2. Problemas Especificos del Proyecto

- Telegram bot: listeners registrados sin cleanup
- Estado conversacional (Map) sin expiracion de sesiones viejas
- Token expiration: logica de "1er dia del mes siguiente" inconsistente
- authService (JWT) importado pero no usado como middleware
- Webhook vs Polling: configuracion inconsistente entre entornos

### 3. Deuda Tecnica

- TODOs pendientes: buscar `TODO`, `FIXME`, `HACK`, `TEMP`
- Codigo comentado
- Metodos muy largos (>50 lineas)
- console.log de debug en produccion
- Dependencias en package.json no utilizadas (stripe, whatsapp-web.js, nodemailer)

### 4. Consistencia

- Manejo de errores inconsistente entre endpoints
- Formato de respuesta API no estandarizado
- Validaciones duplicadas entre controller y service

## Formato de Reporte

```markdown
# Auditoria de [RUTA]

## Resumen
- Archivos analizados: [N]
- Issues criticos: [N]
- Issues importantes: [N]
- Issues menores: [N]

## Issues Criticos (Requieren correccion inmediata)

### [Archivo:Linea] - [Titulo]
- **Problema**: [descripcion]
- **Impacto**: [descripcion]
- **Solucion**: [como corregir]

## Issues Importantes (Corregir pronto)
...

## Issues Menores (Recomendaciones)
...

## Proximos Pasos
1. [accion prioritaria]
2. [siguiente accion]
```

## Ejecutar

Analiza el codigo y genera el reporte de auditoria.
