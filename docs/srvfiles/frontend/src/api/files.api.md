# files.api.ts

**Archivo:** `src/api/files.api.ts`
**Rol:** Módulo central de comunicación con el backend. Define los tipos de datos y todas las operaciones de archivos (listar, subir, borrar, stats, config, descargar).

---

## Función `getApiUrl`

```ts
export function getApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;

  if (window.location.hostname === 'tauri.localhost') {
    return 'http://localhost:3001';
  }

  const backendPort = import.meta.env.VITE_BACKEND_PORT || '3001';
  return `${window.location.protocol}//${window.location.hostname}:${backendPort}`;
}
```

Detecta la URL del backend en tiempo de ejecución. Orden de prioridad:

| Prioridad | Condición | URL resultante |
|---|---|---|
| 1 | Variable `VITE_API_URL` definida | La variable (override explícito) |
| 2 | Hostname es `tauri.localhost` | `http://localhost:3001` |
| 3 | Otro hostname | `{protocolo}//{hostname}:{VITE_BACKEND_PORT\|3001}` |

El caso 3 cubre:
- **Dev mode** (`localhost:5173`): construye `http://localhost:3001`.
- **LAN mobile** (`192.168.1.5:5173`): construye `http://192.168.1.5:3001`.
- **Prod** (`192.168.1.5:3001`): construye `http://192.168.1.5:3001`.

---

## Tipos de datos

```ts
interface FileInfo {
  name: string;
  size: number;      // en bytes
  createdAt: string; // ISO 8601
  downloadUrl: string;
}

interface DiskStats {
  total: number;   // en bytes
  used: number;
  free: number;
}

interface AppConfig {
  appName: string;
  lanIp: string;
  port: number;                  // Puerto del backend (3001)
  frontendPort: number;          // Puerto del frontend Vite (5173)
  maxFileSizeMb: number;
  previewMaxFileSizeMb: number;  // Límite para previsualización (MB)
  lanUrl: string;
}
```

---

## Función `createFilesApi`

```ts
export function createFilesApi(baseUrl: string) {
  const instance = axios.create({ baseURL: `${baseUrl}/api/files` });
  return { getFiles, uploadFiles, deleteFile, getStats, getConfig, getDownloadUrl };
}
```

Patrón **factory**: crea un conjunto de funciones de API ligadas a una URL específica. Esto permite tener múltiples instancias apuntando a diferentes servidores simultáneamente (útil cuando el usuario cambia de servidor en el `ServerSwitcherModal`).

`axios.create({ baseURL })` crea una instancia de Axios con la URL base preconfigurada, de modo que todas las peticiones relativas (`/`, `/upload`, etc.) van a esa URL automáticamente.

### `getFiles`

```ts
getFiles: () => instance.get('/').then((r) => r.data)
```

GET `{baseUrl}/api/files/` → devuelve `{ files: FileInfo[], count: number }`.

### `uploadFiles`

```ts
uploadFiles: (files, onProgress) => {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  return instance.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (event.total && onProgress) {
        onProgress(Math.round((event.loaded * 100) / event.total));
      }
    },
  }).then((r) => r.data);
}
```

- **`FormData`**: el estándar web para enviar archivos en una petición HTTP multipart.
- **`onUploadProgress`**: callback de Axios que se llama mientras la subida progresa. `event.loaded` / `event.total` da el porcentaje actual.

### `deleteFile`

```ts
deleteFile: (filename) => instance.delete(`/${encodeURIComponent(filename)}`).then((r) => r.data)
```

DELETE `{baseUrl}/api/files/{filename}`. `encodeURIComponent` codifica caracteres especiales del nombre del archivo (espacios, acentos, etc.) para que sean válidos en una URL.

### `getStats`

```ts
getStats: () => instance.get('/stats').then((r) => r.data)
```

GET `{baseUrl}/api/files/stats` → devuelve `DiskStats`.

### `getConfig`

```ts
getConfig: () => axios.get(`${baseUrl}/api/config`).then((r) => r.data)
```

Nota: usa `axios` directamente (no `instance`) porque el endpoint es `/api/config`, fuera del prefijo `/api/files`.

### `getDownloadUrl`

```ts
getDownloadUrl: (filename) => {
  const token = getToken();
  const url = `${baseUrl}/api/files/download/${encodeURIComponent(filename)}`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}
```

Construye la URL de descarga directa con el token de sesión como query param (para que funcione dentro de `<a href>` y otras APIs que no permiten cabeceras). Sincrónica — no hace petición de red.

El previsualizador (`PreviewModal`) deriva automáticamente la URL de preview reemplazando `/download/` por `/preview/` en esta URL. Así el token se preserva sin threading adicional.

---

## Instancia por defecto y re-exportaciones

```ts
const _default = createFilesApi(getApiUrl());
export const getFiles = _default.getFiles;
export const uploadFiles = _default.uploadFiles;
// ...etc
```

Para compatibilidad: permite importar las funciones directamente (`import { getFiles } from '../api/files.api'`) en lugar de tener que crear siempre una instancia con `createFilesApi`. En la práctica, `useFiles` usa `createFilesApi` directamente.
