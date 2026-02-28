Ejecuta una instalacion limpia completa del proyecto. Sigue estos pasos en orden:

1. **Eliminar node_modules/** - Ejecuta `rm -rf node_modules`
2. **Eliminar lockfile** - Ejecuta `rm -f package-lock.json`
3. **Reinstalar dependencias** - Ejecuta `npm install`
4. **Verificar instalacion** - Ejecuta `npx tsc --noEmit` para confirmar que TypeScript compila (solo si tsconfig.json existe)
5. **Smoke test** - Ejecuta `timeout 5 npm run dev || true` para confirmar que el servidor inicia

Reporta el resultado de cada paso. Si algun paso falla, detente y reporta el error.
Al final muestra un resumen con: dependencias instaladas, tamano de node_modules, y resultado de cada verificacion.
