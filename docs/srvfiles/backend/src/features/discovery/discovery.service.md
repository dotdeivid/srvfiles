# discovery.service.ts

**Archivo:** `src/features/discovery/discovery.service.ts`
**Rol:** Escanea la subnet local /24 en busca de otras instancias de SrvFiles corriendo en la red, consultando el endpoint `/api/health` de cada IP en paralelo.

---

## `probeHost` (función interna)

```ts
function probeHost(ip: string): Promise<DiscoveredServer | null> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: ip, port: PORT, path: '/api/health', method: 'GET' },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.status === 'ok' && String(json.app).toLowerCase() === 'srvfiles') {
              resolve({ ip, url: `http://${ip}:${PORT}`, appName: json.appName || 'SrvFiles' });
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.setTimeout(500, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.end();
  });
}
```

Hace un GET a `/api/health` en la IP y puerto dados. Identifica SrvFiles verificando `json.status === 'ok'` y `json.app.toLowerCase() === 'srvfiles'`.

### Timeout de 500 ms

Si la IP no responde en 500 ms, `req.destroy()` cancela la conexión y la promesa resuelve con `null`. Este timeout permite escanear 254 IPs en paralelo en aproximadamente 500 ms totales (en lugar de 127 segundos secuencialmente).

### Nunca rechaza

Tanto el timeout como los errores de red (`req.on('error', ...)`) resuelven con `null` en lugar de rechazar. Esto es crítico: `Promise.all` falla si cualquier promesa rechaza, lo que rompería el escaneo completo.

### Acumulación del body

HTTP/1.1 puede fragmentar la respuesta en varios eventos `data`. Se acumulan en `data` y se parsean en el evento `end`.

---

## `scanNetwork`

```ts
export async function scanNetwork(): Promise<DiscoveredServer[]> {
  const localIp = getLanIp();
  const ips = getSubnetIPs();

  log.info('discovery.service.ts', 'Starting LAN scan', { ... });

  const results = await Promise.all(ips.map((ip) => probeHost(ip)));

  const found = results
    .filter((r): r is DiscoveredServer => r !== null)
    .filter((r) => r.ip !== localIp);

  log.info('discovery.service.ts', 'LAN scan complete', { found: found.length });
  return found;
}
```

### `Promise.all(ips.map(...))`

Lanza las 254 peticiones simultáneamente. El tiempo total es el de la petición más lenta (~500 ms), no la suma de todas.

### Type predicate `.filter((r): r is DiscoveredServer => r !== null)`

Después del filtro, TypeScript sabe que el array solo contiene `DiscoveredServer` (no `null`), sin necesidad de casteos adicionales.

### Exclusión del propio servidor

`.filter((r) => r.ip !== localIp)` elimina la IP propia para no aparecer como "otro servidor encontrado".
