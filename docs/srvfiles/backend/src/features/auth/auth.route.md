# auth.route.ts

**Archivo:** `src/features/auth/auth.route.ts`
**Rol:** Define la única ruta del feature de autenticación. Conecta `POST /api/auth` con el controlador.

---

```ts
const router = Router();
router.post('/', authenticate);
export default router;
```

## Ruta definida

| Método | Ruta completa | Controlador |
|--------|---------------|-------------|
| POST | `/api/auth` | `authenticate` |

## Notas

Esta ruta se monta en `app.ts` **sin** el middleware `requireAuth`, ya que es precisamente el endpoint que genera el token. Montarla con `requireAuth` haría imposible autenticarse.

El body esperado es `{ pin: string }`. La respuesta exitosa es `{ token: string }`.
