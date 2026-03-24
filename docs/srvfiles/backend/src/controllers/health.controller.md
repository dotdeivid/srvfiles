# controllers/health.controller.ts

**Archivo:** `src/controllers/health.controller.ts`
**Rol:** Controlador del endpoint de salud. Responde con información básica para identificar el servidor.

---

## Función `getHealth`

```ts
export function getHealth(_req: Request, res: Response): void {
  res.json({
    status: 'ok',
    app: 'SrvFiles',
    appName: APP_NAME,
    timestamp: new Date().toISOString(),
  });
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
|---|---|
| `status: 'ok'` | Confirmación simple de que el servidor está activo. |
| `app: 'SrvFiles'` | Identificador fijo para el scanner. El servicio de descubrimiento busca exactamente este valor para saber que la IP tiene SrvFiles. |
| `appName` | Nombre configurable de esta instancia (desde `APP_NAME`). |
| `timestamp` | Hora actual en formato ISO 8601. Útil para debugging. |

### ¿Por qué `_req`?

El prefijo `_` en `_req` es una convención que indica "este parámetro es requerido por la firma de la función pero no se usa". TypeScript no se queja, y otros desarrolladores entienden que es intencional. El tipo `Request` de Express es obligatorio en la firma para que `res` tenga el tipo correcto.

### `new Date().toISOString()`

`new Date()` crea un objeto con la fecha y hora actual. `.toISOString()` lo convierte al formato estándar internacional: `"2026-03-22T14:30:00.000Z"` (Z = UTC).
