# discovery.controller.ts

**Archivo:** `src/features/discovery/discovery.controller.ts`
**Rol:** Controlador del endpoint `GET /api/discovery/scan`. Delega el escaneo al servicio y retorna los resultados. Captura errores del servicio para evitar que un fallo en el scan propague un 500 sin mensaje.

---

## `scan`

```ts
export async function scan(_req: Request, res: Response): Promise<void> {
  try {
    const servers = await scanNetwork();
    res.json(servers);
  } catch (err) {
    log.error('discovery.controller.ts', 'Network scan failed', { error: String(err) });
    res.status(500).json({ error: 'Network scan failed' });
  }
}
```

La función es `async` porque `scanNetwork()` es asíncrona (escanea 254 IPs en paralelo). En condiciones normales `scanNetwork` no lanza — maneja los errores de red internamente resolviendo `null`. El `try/catch` aquí captura casos excepcionales (fallo del módulo `os`, error de sistema, etc.).

### Respuesta exitosa

```json
[
  { "ip": "192.168.1.10", "url": "http://192.168.1.10:3001", "appName": "SrvFiles" }
]
```

O `[]` si no se encontraron otros servidores.
