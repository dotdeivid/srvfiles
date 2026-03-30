# storage.ts

**Archivo:** `src/infrastructure/storage.ts`
**Rol:** Define y garantiza la existencia del directorio de uploads. Es la fuente de verdad para la ruta de almacenamiento de archivos subidos.

---

## `UPLOADS_DIR`

```ts
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
```

Constante que contiene la ruta absoluta al directorio de uploads.

### Resolución de la ruta

- **Con variable de entorno `UPLOADS_DIR`**: usa la ruta provista. En Tauri sidecar, esta variable apunta a un directorio dentro de los datos de la aplicación (ej: `AppData/srvfiles/uploads` en Windows).
- **Sin variable de entorno**: usa `{cwd}/uploads/`, relativo al directorio de trabajo del proceso.

### Creación automática

El bloque `if (!fs.existsSync(...))` se ejecuta en el momento en que el módulo se importa (al arrancar el servidor). Si el directorio no existe, lo crea con `{ recursive: true }` (crea directorios intermedios si hacen falta; no falla si ya existe).

### ¿Dónde se usa?

- `upload.middleware.ts`: destino de los archivos de Multer.
- `files.service.ts`: directorio base para listar, resolver y eliminar archivos.
