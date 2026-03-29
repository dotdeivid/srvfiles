# config/index.ts

**Archivo:** `src/config/index.ts`
**Rol:** Centraliza toda la configuración del servidor. Lee variables de entorno y provee valores por defecto razonables. Es la única fuente de verdad para constantes de configuración.

---

## Variables de entorno

Node.js expone las variables de entorno del sistema operativo a través del objeto global `process.env`. Si una variable no está definida, se usa un valor por defecto con el operador `||`.

---

## Constantes exportadas

### Red

```ts
export const PORT = parseInt(process.env.PORT || '3001', 10);
export const HOST = '0.0.0.0';
```

- **`PORT`**: puerto donde escucha el servidor. `parseInt(..., 10)` convierte el string de la variable de entorno a entero en base 10. Por defecto: `3001`.
- **`HOST`**: dirección en la que escucha. `0.0.0.0` significa "todas las interfaces" (acepta conexiones de cualquier IP).

### App

```ts
export const APP_NAME = process.env.APP_NAME || 'SrvFiles';
export const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '5173', 10);
```

- **`APP_NAME`**: nombre de la instancia. Se envía en `/api/health` para que el scanner de red identifique el servidor, y se muestra en el header del frontend.
- **`FRONTEND_PORT`**: puerto del servidor Vite en desarrollo. Lo usa el frontend para construir la URL correcta en el QR.

### Archivos

```ts
export const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10240', 10);
export const MAX_UPLOAD_COUNT = parseInt(process.env.MAX_UPLOAD_COUNT || '50', 10);
export const PREVIEW_MAX_FILE_SIZE_MB = parseInt(process.env.PREVIEW_MAX_FILE_SIZE_MB || '1024', 10);
```

- **`MAX_FILE_SIZE_MB`**: límite de tamaño por archivo en MB. Por defecto: 10 GB. Se pasa a Multer.
- **`MAX_UPLOAD_COUNT`**: máximo de archivos simultáneos por petición. Por defecto: 50.
- **`PREVIEW_MAX_FILE_SIZE_MB`**: límite de tamaño para previsualización en MB. Por defecto: 1 GB. Archivos más grandes no pueden previsualizarse; el botón "ver" los rechaza con un toast. Se expone en `/api/config` para que web y mobile lo lean.

---

## Función `getLanIp`

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

### ¿Qué hace?

Detecta la dirección IP privada de la máquina en la red local.

### Paso a paso

1. **`os.networkInterfaces()`**: devuelve un objeto con todas las interfaces de red del sistema (WiFi, Ethernet, loopback, etc.). Cada interfaz tiene una lista de direcciones.

2. **Bucle doble**: itera sobre todas las interfaces y sus direcciones.

3. **Filtro**: busca la primera dirección que sea:
   - `family === 'IPv4'`: solo IPs versión 4 (como `192.168.1.5`).
   - `!net.internal`: excluye la loopback (`127.0.0.1`).

4. **Fallback**: si no hay ninguna interfaz externa (sin WiFi/Ethernet), devuelve `'localhost'`.

### ¿Por qué se llama múltiples veces?

`getLanIp()` es una función y no una constante porque la IP puede cambiar (si el usuario se conecta a una red diferente). Al ser función, siempre lee el estado actual del sistema.

### ¿Dónde se usa?

- En `index.ts` al imprimir la URL de red.
- En `config.controller.ts` para enviársela al frontend.
- En `transfer.service.ts` para asignar la IP LAN a conexiones desde localhost.
- En `discovery.service.ts` para saber cuál es la subnet local.
