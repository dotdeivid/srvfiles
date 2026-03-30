# types.ts

**Archivo:** `src/domain/types.ts`
**Rol:** Define las interfaces TypeScript compartidas por toda la capa backend. No contiene lógica — solo contratos de datos.

---

## ¿Para qué sirve un archivo de tipos centralizado?

Cuando múltiples archivos necesitan la misma forma de datos, se define el tipo una sola vez aquí. Si el contrato cambia (por ejemplo, agregar un campo a `FileInfo`), se cambia en un solo lugar y TypeScript señala todos los lugares que necesitan actualización.

---

## Interfaces de archivos

### `FileInfo`

```ts
export interface FileInfo {
  name: string;
  size: number;
  createdAt: string;
  downloadUrl: string;
}
```

Metadatos de un archivo ya subido al servidor. Es la forma que recibe el frontend en `GET /api/files`. `createdAt` es una cadena ISO 8601. `downloadUrl` es una ruta relativa como `/api/files/download/foto.jpg`.

### `UploadedFileInfo`

```ts
export interface UploadedFileInfo {
  name: string;
  originalName: string;
  size: number;
  downloadUrl: string;
}
```

Respuesta de `POST /api/files/upload`. Incluye el nombre original que envió el cliente y el nombre final en disco (que puede diferir si hubo conflicto de nombres o sanitización).

### `DiskStats`

```ts
export interface DiskStats {
  total: number;
  used: number;
  free: number;
}
```

Estadísticas de disco en bytes. El frontend los formatea con `formatBytes()`. `used` se calcula como `total - free`.

---

## Interfaz de configuración

### `AppConfig`

```ts
export interface AppConfig {
  appName: string;
  lanIp: string;
  port: number;
  httpsPort: number;
  frontendPort: number;
  maxFileSizeMb: number;
  previewMaxFileSizeMb: number;
  lanUrl: string;
}
```

Configuración que el frontend recibe al iniciar. Le permite construir URLs correctas (QR, chip del header), mostrar el límite de tamaño en el DropZone y conocer el puerto HTTPS para conexiones seguras. `lanUrl` es `http://{lanIp}` sin puerto.

---

## Interfaces de transferencia

### `ConnectedClient`

```ts
export interface ConnectedClient {
  ws: WebSocket;
  clientId: string;
  appName: string;
  receiving: boolean;
  ip: string;
  deviceType: 'mobile' | 'desktop';
  isServer: boolean;
  cipher: SessionCipher | null;
}
```

Representa un dispositivo conectado al WebSocket. `cipher` es la clave de sesión AES-256-GCM derivada tras el intercambio ECDH; es `null` si el cliente no activó cifrado. `isServer: true` identifica instancias Tauri.

### `TransferSession`

```ts
export interface TransferSession {
  transferId: string;
  senderClientId: string;
  receiverClientId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}
```

Sesión de transferencia activa entre dos clientes. Existe en memoria desde que el receptor acepta (`send-accept`) hasta que la transferencia se completa, cancela o rechaza.

---

## Interfaz de descubrimiento

### `DiscoveredServer`

```ts
export interface DiscoveredServer {
  ip: string;
  url: string;
  appName: string;
}
```

Servidor SrvFiles encontrado durante un escaneo de red. `url` es la URL completa con protocolo y puerto, lista para conectarse.
