# services/discovery.service.ts

**Archivo:** `src/services/discovery.service.ts`
**Rol:** Escanea la subnet local en busca de otras instancias de SrvFiles corriendo en la red.

---

## Tipo `DiscoveredServer`

```ts
export interface DiscoveredServer {
  ip: string;       // ej: "192.168.1.10"
  url: string;      // ej: "http://192.168.1.10:3001"
  appName: string;  // nombre de esa instancia
}
```

---

## Función `getSubnetIPs`

```ts
function getSubnetIPs(): string[] {
  const lanIp = getLanIp();
  if (lanIp === 'localhost') return [];

  const parts = lanIp.split('.');
  const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
  return Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);
}
```

### ¿Qué es una subnet /24?

En una red típica de hogar u oficina, las IPs tienen la forma `192.168.1.X` donde `X` va de 1 a 254. Los primeros tres octetos (`192.168.1`) identifican la red; el último identifica el dispositivo. Una subnet `/24` tiene 254 hosts posibles.

### Paso a paso

- Si la IP local es `192.168.1.5`:
  - `parts = ['192', '168', '1', '5']`
  - `subnet = '192.168.1'`
  - `Array.from({ length: 254 }, (_, i) => ...)` genera `['192.168.1.1', '192.168.1.2', ..., '192.168.1.254']`

- Si `getLanIp()` devuelve `'localhost'` (sin red), retorna `[]` para no intentar escanear.

---

## Función `probeHost`

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
            if (json.status === 'ok' && json.app === 'SrvFiles') {
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

### ¿Qué hace?

Hace un GET a `/api/health` en la IP dada. Si la respuesta tiene `{ status: 'ok', app: 'SrvFiles' }`, esa IP tiene SrvFiles. Si no responde, da error, o devuelve otra cosa, resuelve con `null`.

### `new Promise((resolve) => ...)`

A diferencia de `fetch` o `axios`, el módulo `http` nativo de Node.js usa una API basada en eventos, no en promesas. Se envuelve en una promesa para poder usarla con `async/await`.

### Acumulación del body

```ts
let data = '';
res.on('data', (chunk) => { data += chunk; });
res.on('end', () => { JSON.parse(data); ... });
```

HTTP/1.1 puede fragmentar la respuesta en varios eventos `data`. Se acumulan en un string y se parsean cuando llega el evento `end`.

### `req.setTimeout(500, ...)`

Timeout de 500 milisegundos. Si la IP no responde en ese tiempo:
- `req.destroy()`: cancela la conexión.
- `resolve(null)`: la promesa resuelve sin error.

500ms es suficiente para una red local rápida. Si se usara 2-3 segundos, escanear 254 IPs secuencialmente tomaría 8+ minutos — por eso se hace todo en paralelo.

### Nunca rechaza (`reject`)

`req.on('error', () => resolve(null))` captura errores de red (IP no alcanzable, conexión rechazada) y resuelve con `null` en lugar de rechazar. Esto es intencional: `Promise.all` falla si cualquier promesa rechaza, lo que rompería el escaneo completo.

---

## Función `scanNetwork`

```ts
export async function scanNetwork(): Promise<DiscoveredServer[]> {
  const localIp = getLanIp();
  const ips = getSubnetIPs();

  const results = await Promise.all(ips.map((ip) => probeHost(ip)));

  return results
    .filter((r): r is DiscoveredServer => r !== null)
    .filter((r) => r.ip !== localIp);
}
```

### `Promise.all(ips.map(...))`

Lanza las 254 peticiones **simultáneamente**. `Promise.all` espera a que todas terminen (resuelvan o rechacen). Al ser en paralelo, el tiempo total es el de la petición más lenta (~500ms por el timeout), no la suma de todas (254 × 500ms = 127 segundos).

### `.filter((r): r is DiscoveredServer => r !== null)`

El type predicate `r is DiscoveredServer` le dice a TypeScript que después de este filtro, todos los elementos son `DiscoveredServer` (no `null`). Sin el type predicate, TypeScript seguiría pensando que el array puede contener `null`.

### `.filter((r) => r.ip !== localIp)`

Excluye el propio servidor. Si no se filtrara, el servidor se encontraría a sí mismo en la lista de "otros servidores".
