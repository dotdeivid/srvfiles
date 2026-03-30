# network.ts

**Archivo:** `src/infrastructure/network.ts`
**Rol:** Funciones de infraestructura para obtener información de la red local. Detecta la IP LAN del host y genera la lista de IPs de la subnet /24 para el escaneo de descubrimiento.

---

## `getLanIp`

```ts
export function getLanIp(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}
```

Devuelve la primera dirección IPv4 no interna (la IP LAN del host, ej: `192.168.1.5`). Si no hay interfaces externas (sin WiFi/Ethernet), devuelve `'localhost'` como fallback.

### Paso a paso

1. `os.networkInterfaces()` devuelve todas las interfaces de red (WiFi, Ethernet, loopback, etc.) con sus direcciones.
2. El bucle doble itera sobre interfaces y sus direcciones.
3. El filtro busca: `family === 'IPv4'` (descarta IPv6) y `!net.internal` (descarta `127.0.0.1`).
4. Devuelve la primera que coincida.

### ¿Por qué es una función y no una constante?

La IP puede cambiar durante la ejecución (cambio de red WiFi, reconexión). Al ser función, siempre lee el estado actual del sistema.

### ¿Dónde se usa?

- `index.ts`: imprime la URL de red al arrancar.
- `config.controller.ts`: envía la IP al frontend en `/api/config`.
- `transfer.handler.ts`: asigna la IP LAN a conexiones loopback.
- `discovery.service.ts`: excluye el propio servidor del resultado del escaneo.

---

## `getSubnetIPs`

```ts
export function getSubnetIPs(): string[] {
  const lanIp = getLanIp();
  if (lanIp === 'localhost') return [];

  const parts = lanIp.split('.');
  const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
  return Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);
}
```

Genera los 254 hosts posibles de la subnet /24 del host (ej: `192.168.1.1` a `192.168.1.254`). Si no hay interfaz externa, devuelve `[]` para evitar un escaneo vacío.

Solo lo usa `discovery.service.ts` para construir la lista de IPs a sondear.
