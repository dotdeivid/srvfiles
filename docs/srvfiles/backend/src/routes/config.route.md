# routes/config.route.ts

**Archivo:** `src/routes/config.route.ts`
**Rol:** Define la ruta para el endpoint de configuración del servidor.

---

```ts
import { Router } from 'express';
import { getConfig } from '../controllers/config.controller';

const router = Router();

router.get('/', getConfig);

export default router;
```

## Ruta definida

| Método | Ruta completa | Controlador |
|---|---|---|
| GET | `/api/config` | `getConfig` |

## ¿Para qué sirve?

El frontend llama a este endpoint al iniciar (`useFiles → fetchConfig`) para obtener:
- La IP LAN del servidor → para construir la URL del QR y el chip del header.
- Los puertos → para construir URLs correctas en producción vs desarrollo.
- El nombre de la app → para mostrarlo en el header.
- El límite de tamaño → para mostrarlo en el tooltip del DropZone.

Sin este endpoint, el frontend tendría que hardcodear estos valores o inferirlos de la URL del navegador, lo que no funciona en todos los escenarios.
