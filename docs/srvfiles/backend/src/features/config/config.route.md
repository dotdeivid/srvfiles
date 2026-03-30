# config.route.ts

**Archivo:** `src/features/config/config.route.ts`
**Rol:** Define la ruta del feature de configuración. Conecta `GET /api/config` con el controlador.

---

```ts
const router = Router();
router.get('/', getConfig);
export default router;
```

## Ruta definida

| Método | Ruta completa | Controlador |
|--------|---------------|-------------|
| GET | `/api/config` | `getConfig` |

## ¿Para qué sirve?

El frontend llama a este endpoint al iniciar (`useConfig`) para obtener la IP LAN, los puertos, el nombre de la app y los límites de tamaño. Sin este endpoint, el frontend tendría que hardcodear o inferir estos valores de la URL del navegador, lo que no funciona en todos los escenarios (Tauri, producción, dev).

Esta ruta está protegida por `requireAuth` (montada así en `app.ts`).
