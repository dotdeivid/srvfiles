# files.service.ts

**Archivo:** `src/features/files/files.service.ts`
**Rol:** Capa de lógica de negocio para operaciones de archivos. Interactúa directamente con el sistema de archivos del servidor. No tiene dependencias HTTP.

---

## `listFiles`

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

Lee el directorio de uploads con `fs.readdirSync`, filtra el `.gitkeep` (archivo que Git usa para rastrear el directorio vacío), obtiene los metadatos de cada archivo con `fs.statSync`, y los ordena del más nuevo al más viejo.

`encodeURIComponent(name)` codifica caracteres especiales en la URL de descarga (ej: espacios → `%20`).

---

## `processUploadedFiles`

```ts
export function processUploadedFiles(files: Express.Multer.File[]): UploadedFileInfo[] {
  return files.map((file) => ({
    name: file.filename,
    originalName: file.originalname,
    size: file.size,
    downloadUrl: `/api/files/download/${encodeURIComponent(file.filename)}`,
  }));
}
```

Convierte el formato interno de Multer (`Express.Multer.File`, con muchos campos internos) al formato público de la API (`UploadedFileInfo`). Incluye el nombre original y el nombre en disco (que puede diferir tras sanitización o resolución de conflictos).

---

## `resolveFilePath`

```ts
export function resolveFilePath(filename: string): { filePath: string; exists: boolean } {
  sanitizeFilename(filename); // throws on invalid
  const filePath = path.join(UPLOADS_DIR, filename);
  return { filePath, exists: fs.existsSync(filePath) };
}
```

Valida y resuelve la ruta absoluta de un archivo:

1. `sanitizeFilename(filename)` lanza si el nombre contiene path traversal o caracteres prohibidos. El controlador captura el error para responder `400`.
2. `path.join(UPLOADS_DIR, filename)` construye la ruta absoluta de forma segura.
3. `fs.existsSync(filePath)` verifica si el archivo existe en disco.

---

## `deleteFile`

```ts
export function deleteFile(filename: string): boolean {
  const { filePath, exists } = resolveFilePath(filename);
  if (!exists) {
    log.warn('files.service.ts', 'Delete requested for non-existent file', { filename });
    return false;
  }
  fs.unlinkSync(filePath);
  log.info('files.service.ts', 'File deleted', { filename });
  return true;
}
```

Retorna `true` en éxito y `false` si el archivo no existe (el controlador responde `404`). `fs.unlinkSync` elimina el archivo de forma sincrónica.

---

## `getDiskStats`

```ts
export async function getDiskStats(): Promise<DiskStats> {
  try {
    const diskSpace = await checkDiskSpace(UPLOADS_DIR);
    return {
      total: diskSpace.size,
      free: diskSpace.free,
      used: diskSpace.size - diskSpace.free,
    };
  } catch (err) {
    log.error('files.service.ts', 'Failed to get disk stats', { error: String(err) });
    throw err;
  }
}
```

Usa la librería `check-disk-space` para consultar el espacio del volumen donde está `UPLOADS_DIR`. `used` no viene directamente de la librería — se calcula como `total - free`. Si la librería falla (sistema de archivos no soportado, etc.), re-lanza el error para que el controlador responda `500`.
