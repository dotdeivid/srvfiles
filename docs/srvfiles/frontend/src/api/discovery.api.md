# discovery.api.ts

**Archivo:** `src/api/discovery.api.ts`
**Rol:** Módulo de API para el descubrimiento de servidores SrvFiles en la red local.

---

## Tipo `DiscoveredServer`

```ts
export interface DiscoveredServer {
  ip: string;       // Dirección IP privada (ej: "192.168.1.10")
  url: string;      // URL completa del backend (ej: "http://192.168.1.10:3001")
  appName: string;  // Nombre de la instancia de SrvFiles encontrada
}
```

---

## Función `scanNetwork`

```ts
export async function scanNetwork(): Promise<DiscoveredServer[]> {
  const localApi = getApiUrl();
  const { data } = await axios.get<DiscoveredServer[]>(
    `${localApi}/api/discovery/scan`,
    { timeout: 15000 }
  );
  return data;
}
```

### ¿Qué hace?

Le pide al **servidor local** que escanee la subnet `/24` en busca de otras instancias de SrvFiles. El frontend no hace el escaneo directamente — lo delega al backend, que tiene acceso directo a la red.

### Flujo

```
Frontend → GET /api/discovery/scan → Backend local
                                           ↓
                            Escanea 192.168.1.1–254
                                           ↓
                  Para cada IP, hace GET /api/health y verifica
                  { app: 'SrvFiles' } en la respuesta
                                           ↓
Frontend ← [ { ip, url, appName }, ... ] ← Backend
```

### `timeout: 15000`

El timeout de 15 segundos es inusualmente alto porque el escaneo de red puede tardar varios segundos al probar 254 IPs en paralelo.

### `axios.get<DiscoveredServer[]>(...)`

El tipo genérico `<DiscoveredServer[]>` le dice a TypeScript que `data` es un array de `DiscoveredServer`. Axios no valida esto en runtime — es solo información para el compilador de TypeScript.

---

## ¿Por qué el escaneo es responsabilidad del backend y no del frontend?

Dos razones:

1. **CORS**: el navegador bloquea peticiones HTTP a otros orígenes (otras IPs) que no devuelven los headers CORS correctos. El backend en Node.js no tiene esta restricción.

2. **Velocidad**: el backend puede hacer las 254 peticiones en paralelo con control fino sobre timeouts individuales. El navegador limitaría las conexiones simultáneas.
