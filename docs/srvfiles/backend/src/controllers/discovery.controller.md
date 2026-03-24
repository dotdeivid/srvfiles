# controllers/discovery.controller.ts

**Archivo:** `src/controllers/discovery.controller.ts`
**Rol:** Controlador del endpoint de descubrimiento. Delega el escaneo al servicio y retorna los resultados.

---

## Función `scan`

```ts
export async function scan(_req: Request, res: Response): Promise<void> {
  const servers = await scanNetwork();
  res.json(servers);
}
```

### Simpleza intencional

Este controlador es deliberadamente mínimo: su única responsabilidad es conectar la capa HTTP con el servicio. No valida parámetros (no hay ninguno), no transforma datos, no maneja errores parciales.

### `async/await` y `Promise<void>`

La función es `async` porque `scanNetwork()` devuelve una `Promise` (el escaneo es asíncrono). `await` pausa la ejecución hasta que la promesa se resuelve, y luego `res.json(servers)` envía la respuesta. La promesa se resuelve con `void` porque `res.json()` envía la respuesta pero no retorna un valor útil.

### ¿Qué pasa si el escaneo falla?

`scanNetwork()` está diseñado para no fallar: usa `Promise.all` sobre todas las IPs y maneja los errores internamente (cada probe individual rechaza silenciosamente). Si no hay red, devuelve `[]`. Por eso no hay un `try/catch` aquí.

### Respuesta

```json
[
  { "ip": "192.168.1.10", "url": "http://192.168.1.10:3001", "appName": "SrvFiles" },
  { "ip": "192.168.1.15", "url": "http://192.168.1.15:3001", "appName": "Mi Servidor" }
]
```

O `[]` si no se encontraron otros servidores.
