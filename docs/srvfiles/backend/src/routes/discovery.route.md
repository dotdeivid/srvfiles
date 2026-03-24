# routes/discovery.route.ts

**Archivo:** `src/routes/discovery.route.ts`
**Rol:** Define la ruta para el endpoint de descubrimiento de servidores en la red.

---

```ts
import { Router } from 'express';
import { scan } from '../controllers/discovery.controller';

const router = Router();

router.get('/scan', scan);

export default router;
```

## Ruta definida

| Método | Ruta completa | Controlador |
|---|---|---|
| GET | `/api/discovery/scan` | `scan` |

## ¿Por qué es un GET y no un POST?

Semánticamente, un GET es "dame información" y un POST es "haz algo que cambia estado". Aunque el escaneo de red tiene efectos (hace peticiones a otras IPs), es una operación de **consulta** y no modifica nada en el servidor. Por convención REST, se usa GET.

## Nota de latencia

Este endpoint puede tardar hasta ~15 segundos porque escanea toda la subnet. El frontend lo llama con un timeout de 15 segundos precisamente por eso. El spinner del `ServerSwitcherModal` se muestra mientras espera.
