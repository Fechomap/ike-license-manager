---
paths:
  - "prisma/**"
  - "src/models/**"
  - "src/lib/prisma.ts"
  - "src/config/database.ts"
---

# Reglas de Migraciones de Base de Datos (Prisma + PostgreSQL)

## Principio fundamental

**NUNCA modificar el schema sin generar y commitear la migración correspondiente.**
Una migración sin versionado es código roto esperando a explotar en producción.

---

## Checklist obligatorio para CUALQUIER cambio de schema

### 1. Antes de tocar `prisma/schema.prisma`
- [ ] Leer el schema actual completo
- [ ] Identificar si el cambio es aditivo (nueva columna/tabla) o destructivo (rename, drop)
- [ ] Para cambios destructivos: planificar migración en 2 pasos (ver sección abajo)

### 2. Después de modificar el schema
- [ ] Ejecutar `npx prisma migrate dev --name <nombre_descriptivo>`
- [ ] Revisar el SQL generado en `prisma/migrations/<timestamp>_<nombre>/migration.sql`
- [ ] Verificar que NO haya `DROP` accidentales
- [ ] Ejecutar `npx tsc --noEmit` — 0 errores

### 3. Antes de commitear
- [ ] `prisma/migrations/**` DEBE estar incluido en el commit
- [ ] `prisma/migration_lock.toml` DEBE estar incluido
- [ ] `src/generated/` NUNCA se commitea (está en .gitignore, se genera en build)

### 4. Validación contra BD limpia
- [ ] Probar `npx prisma migrate deploy` contra una BD vacía
- [ ] Verificar que la tabla se crea correctamente con todos los índices

---

## Nomenclatura de migraciones

Usar nombres descriptivos en snake_case que indiquen la acción:

```bash
# Bien
npx prisma migrate dev --name add_subscription_table
npx prisma migrate dev --name add_index_on_email
npx prisma migrate dev --name rename_machine_id_to_device_id

# Mal
npx prisma migrate dev --name update
npx prisma migrate dev --name fix
npx prisma migrate dev --name changes
```

---

## Cambios destructivos (requieren migración en 2 pasos)

### Renombrar columna
1. **Paso 1**: Agregar columna nueva, migrar datos con SQL custom, deploy
2. **Paso 2**: Eliminar columna vieja en migración siguiente

### Eliminar columna/tabla
1. **Paso 1**: Dejar de usar la columna en código, deploy
2. **Paso 2**: Eliminar columna del schema, generar migración, deploy

### Cambiar tipo de columna
1. Evaluar si Prisma puede hacer cast automático
2. Si no: crear columna nueva con tipo correcto, migrar datos, eliminar vieja

**NUNCA hacer rename + drop en una sola migración en producción.**

---

## Operaciones atómicas en queries

### Patrón obligatorio para write condicional
Usar `updateMany` con WHERE condicional en lugar de read-then-write:

```typescript
// CORRECTO: Atómico
const result = await prisma.token.updateMany({
  where: { token, isRedeemed: false, expiresAt: { gte: now } },
  data: { isRedeemed: true, ... },
});
if (result.count === 0) { /* investigar razón */ }

// INCORRECTO: Race condition
const record = await prisma.token.findUnique({ where: { token } });
if (!record.isRedeemed) {
  await prisma.token.update({ where: { token }, data: { isRedeemed: true } });
}
```

### Cuándo usar transacciones
- Cuando se modifican múltiples tablas que deben ser consistentes
- `prisma.$transaction([...])` para batch atómico
- `prisma.$transaction(async (tx) => {...})` para lógica condicional

---

## Entornos

| Comando | Cuándo usar | Dónde |
|---------|-------------|-------|
| `prisma migrate dev` | Desarrollo: genera + aplica migración | Local |
| `prisma migrate deploy` | Producción: aplica migraciones pendientes | CI/CD, Railway |
| `prisma db push` | Prototipos rápidos SIN historial | Solo local, NUNCA en prod |
| `prisma migrate reset` | Resetear BD completa | Solo local, NUNCA en prod |

**NUNCA ejecutar `migrate dev` en producción.**
**NUNCA ejecutar `db push` en producción.**
**NUNCA ejecutar `migrate reset` en producción.**

---

## Procfile y deploy

El Procfile DEBE ejecutar migraciones antes de iniciar la app:

```
web: npx prisma migrate deploy && node dist/app.js
```

Esto garantiza que la BD esté sincronizada con el schema antes de que el código la use.

---

## Archivos que SIEMPRE van al commit juntos

Cuando se cambia el schema de BD, estos archivos forman una unidad atómica:

1. `prisma/schema.prisma` — definición del schema
2. `prisma/migrations/<timestamp>_<name>/migration.sql` — SQL generado
3. `src/models/tokenModel.ts` (u otros modelos) — tipos actualizados
4. `src/services/tokenService.ts` (u otros services) — queries actualizadas
5. `src/scripts/*` — si los scripts usan los campos modificados

**NUNCA commitear schema.prisma sin su migración correspondiente.**

---

## Rollback de emergencia

Si una migración falla en producción:
1. **NO** intentar revertir manualmente el SQL
2. Crear una nueva migración que revierta los cambios
3. `npx prisma migrate dev --name rollback_<nombre_original>`
4. Deploy de la migración de rollback

---

## Validación en CI/CD

El pipeline DEBE incluir:
```bash
prisma generate          # Genera el cliente
tsc --noEmit             # Verifica tipos
prisma migrate deploy    # Aplica migraciones (contra BD de staging)
```
