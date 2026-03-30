# health.controller.ts

**Archivo:** `src/features/health/health.controller.ts`
**Rol:** Controlador del endpoint `GET /api/health`. Responde con información básica que permite identificar el servidor e integra el mecanismo de descubrimiento de red.

---

## `getHealth`

```ts
export function getHealth(_req: Request, res: Response): void {
  res.json({ status: 'ok', app: 'SrvFiles', appName: APP_NAME, timestamp: new Date().toISOString() });
}
```

### Respuesta

```json
{
  "status": "ok",
  "app": "SrvFiles",
  "appName": "Mi Servidor",
  "timestamp": "2026-03-22T14:30:00.000Z"
}
```

### Campos

| Campo | Propósito |
|-------|-----------|
| `status: 'ok'` | Confirmación simple de que el servidor está activo. |
| `app: 'SrvFiles'` | Identificador fijo para el scanner de red. `discovery.service.ts` busca exactamente este valor (`json.app.toLowerCase() === 'srvfiles'`) para identificar instancias. |
| `appName` | Nombre configurable de esta instancia (desde `APP_NAME`). |
| `timestamp` | Hora actual en ISO 8601. Útil para debugging. |

### `_req`

El prefijo `_` indica que el parámetro es requerido por la firma de Express pero no se usa. Es una convención que evita que TypeScript/ESLint emita advertencias de "parámetro no usado".

### Ruta pública

Este endpoint no requiere autenticación — está montado antes del middleware `requireAuth` en `app.ts`. Cualquier dispositivo en la red puede consultarlo, lo que es necesario para que el scanner de descubrimiento funcione.
