# discovery.route.ts

**Archivo:** `src/features/discovery/discovery.route.ts`
**Rol:** Define la ruta del feature de descubrimiento. Conecta `GET /api/discovery/scan` con el controlador.

---

```ts
const router = Router();
router.get('/scan', scan);
export default router;
```

## Ruta definida

| Método | Ruta completa | Controlador |
|--------|---------------|-------------|
| GET | `/api/discovery/scan` | `scan` |

## Notas

Esta ruta está protegida por `requireAuth` (montada así en `app.ts`).

El endpoint puede tardar hasta ~500 ms (el timeout de cada probe) ya que escanea toda la subnet /24 en paralelo. El frontend lo llama con un timeout generoso y muestra un spinner durante la espera.
