# types/index.ts

**Archivo:** `src/types/index.ts`
**Rol:** Define las interfaces TypeScript compartidas por toda la capa backend. No contiene lógica — solo contratos de datos.

---

## ¿Para qué sirve un archivo de tipos centralizado?

Cuando múltiples archivos necesitan la misma forma de datos, se define el tipo una sola vez aquí. Si el contrato cambia (por ejemplo, agregar un campo a `FileInfo`), se cambia en un solo lugar y TypeScript señala todos los lugares que necesitan actualización.

---

## Interfaces

### `FileInfo`

```ts
export interface FileInfo {
  name: string;
  size: number;       // en bytes
  createdAt: string;  // ISO 8601 (ej: "2026-03-22T14:30:00.000Z")
  downloadUrl: string; // ruta relativa (ej: "/api/files/download/foto.jpg")
}
```

Representa los metadatos de un archivo ya subido al servidor. Esta es la forma que recibe el frontend en `GET /api/files`.

### `UploadedFileInfo`

```ts
export interface UploadedFileInfo {
  name: string;          // Nombre sanitizado (el que quedó en disco)
  originalName: string;  // Nombre original que envió el cliente
  size: number;
  downloadUrl: string;
}
```

Respuesta de `POST /api/files/upload`. Incluye el nombre original para mostrárselo al usuario, y el nombre final (que puede ser diferente si hubo un conflicto de nombres).

### `DiskStats`

```ts
export interface DiskStats {
  total: number;  // en bytes
  used: number;   // en bytes
  free: number;   // en bytes
}
```

Estadísticas de disco que se envían al frontend para el indicador de `DiskStats`. Todos los valores son en bytes crudos — el frontend los formatea con `formatBytes()`.

### `AppConfig`

```ts
export interface AppConfig {
  appName: string;
  lanIp: string;         // IP privada (ej: "192.168.1.5")
  port: number;          // Puerto del backend (3001)
  frontendPort: number;  // Puerto del frontend Vite (5173)
  maxFileSizeMb: number; // Límite de subida en MB
  lanUrl: string;        // URL base sin puerto (ej: "http://192.168.1.5")
}
```

Configuración que el frontend recibe al iniciar. Le permite:
- Mostrar la IP correcta en el chip del header.
- Construir la URL del QR con el puerto correcto.
- Mostrar el límite de tamaño en el `DropZone`.

---

## Concepto: `interface` en TypeScript

Una `interface` describe la **forma** de un objeto, sin crear ningún valor. Es solo información para el compilador. Si un objeto no tiene todos los campos requeridos, o tiene los tipos incorrectos, TypeScript lo marca como error en tiempo de compilación (antes de ejecutar).
