Ejecuta TODAS las validaciones de calidad del proyecto en orden. Cada paso debe pasar antes de continuar al siguiente. Muestra el resultado de cada paso con claridad.

## Pasos a ejecutar (en orden estricto):

1. **TypeScript typecheck** - `npx tsc --noEmit` - Verifica 0 errores de tipos (solo si tsconfig.json existe)
2. **ESLint** - `npx eslint src/` - Verifica 0 errores y 0 warnings
3. **Prettier** - `npx prettier --check src/` - Verifica que todo el codigo esta formateado
4. **Tests** - `npx vitest run` - Verifica que todos los tests pasan (solo si hay tests configurados)
5. **Servidor** - `npm run dev` - Verifica que el servidor inicia correctamente (matar tras 5 segundos)

## Reglas:

- Si un paso FALLA, detente ahi y reporta el error con detalle
- Si todos pasan, muestra un resumen final con el veredicto: GO o NO-GO
- Si Prettier falla, ejecuta `npx prettier --write src/` para corregir automaticamente antes de reportar fallo
- NO corrijas nada mas automaticamente, solo reporta
- Si una herramienta no esta instalada, reportar como paso omitido (no como fallo)
