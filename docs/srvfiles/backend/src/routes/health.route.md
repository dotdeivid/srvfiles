# routes/health.route.ts

**Archivo:** `src/routes/health.route.ts`
**Rol:** Define la ruta para el endpoint de salud del servidor.

---

```ts
import { Router } from 'express';
import { getHealth } from '../controllers/health.controller';

const router = Router();

router.get('/', getHealth);

export default router;
```

## Ruta definida

| Método | Ruta completa | Controlador |
|---|---|---|
| GET | `/api/health` | `getHealth` |

## ¿Para qué sirve?

El endpoint `/api/health` es un **health check**: una ruta liviana que responde rápido y confirma que el servidor está activo. Lo usan:

1. **El scanner de red** (`discovery.service.ts`): para identificar qué IPs tienen SrvFiles corriendo. Prueba `/api/health` en cada IP de la subnet y verifica que la respuesta tenga `{ app: 'SrvFiles' }`.

2. **Monitoring**: en producción, los sistemas de monitoreo comprueban este endpoint periódicamente para alertar si el servidor cae.

La separación en su propio router (aunque sea una sola ruta) sigue el mismo patrón arquitectural que el resto del backend.
