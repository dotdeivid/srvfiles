# config/index.ts

**Archivo:** `src/config/index.ts`
**Rol:** Centraliza toda la configuración del servidor. Lee variables de entorno y provee valores por defecto razonables. Es la única fuente de verdad para constantes de configuración.

---

## Variables de entorno

Node.js expone las variables de entorno del sistema operativo a través del objeto global `process.env`. Si una variable no está definida, se usa un valor por defecto con el operador `||` o `??`.

---

## Constantes exportadas

### Red

```ts
export const PORT = parseInt(process.env.PORT || '3001', 10);
export const HOST = '0.0.0.0';

export const HTTPS_PORT = PORT + 1;
export const CERTS_DIR = process.env.CERTS_DIR
  ?? path.resolve(process.cwd(), 'certs');
```

- **`PORT`**: puerto donde escucha el servidor HTTP. Por defecto: `3001`.
- **`HOST`**: dirección en la que escuchan ambos servidores. `0.0.0.0` significa "todas las interfaces" (acepta conexiones de cualquier IP, incluida la LAN).
- **`HTTPS_PORT`**: puerto del servidor HTTPS. Siempre `PORT + 1` (por defecto `3002`).
- **`CERTS_DIR`**: directorio donde se persisten `key.pem` y `cert.pem`. Por defecto `{cwd}/certs/`. En Tauri sidecar se sobreescribe con una ruta dentro del directorio de datos de la app.

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

- **`MAX_FILE_SIZE_MB`**: límite de tamaño por archivo en MB. Por defecto: 10240 MB (10 GB). Se pasa a Multer.
- **`MAX_UPLOAD_COUNT`**: máximo de archivos simultáneos por petición. Por defecto: 50.
- **`PREVIEW_MAX_FILE_SIZE_MB`**: límite de tamaño para previsualización en MB. Por defecto: 1024 MB (1 GB). Se expone en `/api/config` para que web y mobile lo lean; archivos más grandes no pueden previsualizarse.

---

## Nota: getLanIp movido a infrastructure/network.ts

En la versión anterior, `getLanIp` estaba definida en este archivo. Tras el refactor, se movió a `src/infrastructure/network.ts` junto con `getSubnetIPs`. Este archivo solo contiene constantes de configuración estáticas.
