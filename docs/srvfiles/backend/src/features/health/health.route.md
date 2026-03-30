# health.route.ts

**Archivo:** `src/features/health/health.route.ts`
**Rol:** Define la ruta del feature de salud. Conecta `GET /api/health` con el controlador.

---

```ts
const router = Router();
router.get('/', getHealth);
export default router;
```

## Ruta definida

| Método | Ruta completa | Controlador |
|--------|---------------|-------------|
| GET | `/api/health` | `getHealth` |

## Notas

Esta ruta se monta en `app.ts` **sin** `requireAuth` — es una ruta pública. El scanner de red (`discovery.service.ts`) la consulta en cada IP de la subnet sin autenticación para identificar instancias de SrvFiles.
