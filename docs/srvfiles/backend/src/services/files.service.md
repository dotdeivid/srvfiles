# services/files.service.ts

**Archivo:** `src/services/files.service.ts`
**Rol:** Capa de lógica de negocio para operaciones de archivos. Interactúa directamente con el sistema de archivos del servidor. No tiene dependencias HTTP.

---

## Función `listFiles`

```ts
export function listFiles(): FileInfo[] {
  const fileNames = fs.readdirSync(UPLOADS_DIR);

  return fileNames
    .filter((name) => name !== '.gitkeep')
    .map((name) => {
      const filePath = path.join(UPLOADS_DIR, name);
      const stats = fs.statSync(filePath);
      return {
        name,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        downloadUrl: `/api/files/download/${encodeURIComponent(name)}`,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
```

### `fs.readdirSync(UPLOADS_DIR)`

Lee el contenido del directorio de forma **sincrónica** (bloquea el event loop hasta terminar). Para listar archivos locales esto es aceptable — es una operación rápida en disco local.

### `.filter((name) => name !== '.gitkeep')`

`.gitkeep` es un archivo vacío que existe para que Git pueda rastrear el directorio vacío de uploads (Git no guarda directorios vacíos). Se filtra para no mostrarlo al usuario.

### `fs.statSync(filePath)`

Obtiene los metadatos del archivo: tamaño, fechas, permisos, etc.

- **`stats.size`**: tamaño en bytes.
- **`stats.birthtime`**: fecha de creación del archivo.

### `.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())`

Ordena de más nuevo a más viejo. La comparación `b - a` (en vez de `a - b`) da orden descendente. `.getTime()` convierte la fecha a milisegundos desde el epoch para poder restar.

### `encodeURIComponent(name)`

Codifica el nombre para que sea seguro en una URL. Un archivo llamado `"mi foto 2024.jpg"` se convierte en `"mi%20foto%202024.jpg"` en la URL de descarga.

---

## Función `processUploadedFiles`

```ts
export function processUploadedFiles(files: Express.Multer.File[]): UploadedFileInfo[] {
  return files.map((file) => ({
    name: file.filename,          // Nombre en disco (sanitizado)
    originalName: file.originalname, // Nombre que envió el cliente
    size: file.size,
    downloadUrl: `/api/files/download/${encodeURIComponent(file.filename)}`,
  }));
}
```

Convierte el formato interno de Multer (`Express.Multer.File`) al formato público de la API (`UploadedFileInfo`). Multer tiene muchos más campos internos — esta función selecciona solo los relevantes para el cliente.

---

## Función `resolveFilePath`

```ts
export function resolveFilePath(filename: string): { filePath: string; exists: boolean } {
  sanitizeFilename(filename); // throws on invalid
  const filePath = path.join(UPLOADS_DIR, filename);
  return { filePath, exists: fs.existsSync(filePath) };
}
```

Valida y resuelve la ruta absoluta de un archivo:

1. **`sanitizeFilename(filename)`**: si el nombre contiene path traversal, lanza un error que el controlador captura para responder `400`.
2. **`path.join(UPLOADS_DIR, filename)`**: construye la ruta absoluta. `path.join` normaliza separadores y rutas relativas — pero `sanitizeFilename` ya eliminó `..` y `/`, así que es seguro.
3. **`fs.existsSync(filePath)`**: verifica si el archivo existe en disco.

---

## Función `deleteFile`

```ts
export function deleteFile(filename: string): boolean {
  const { filePath, exists } = resolveFilePath(filename);
  if (!exists) return false;

  fs.unlinkSync(filePath);
  return true;
}
```

- Usa `resolveFilePath` para validar y localizar el archivo.
- Si no existe, retorna `false` (el controlador responde `404`).
- `fs.unlinkSync`: elimina el archivo del sistema de archivos de forma sincrónica.
- Retorna `true` en éxito.

---

## Función `getDiskStats`

```ts
export async function getDiskStats(): Promise<DiskStats> {
  const diskSpace = await checkDiskSpace(UPLOADS_DIR);
  return {
    total: diskSpace.size,
    free: diskSpace.free,
    used: diskSpace.size - diskSpace.free,
  };
}
```

Usa la librería `check-disk-space` para consultar el espacio del volumen donde está `UPLOADS_DIR`.

- **`checkDiskSpace(path)`**: devuelve `{ size, free }` en bytes para el volumen que contiene ese path. Es async porque en algunos sistemas operativos la consulta de disco es asíncrona.
- **`used`**: no viene directamente de la librería — se calcula como `total - free`.

### ¿Por qué medir el disco en vez del tamaño de los uploads?

El disco total disponible es más útil para el usuario: muestra si hay espacio para seguir subiendo archivos, independientemente del tamaño de los uploads actuales.
