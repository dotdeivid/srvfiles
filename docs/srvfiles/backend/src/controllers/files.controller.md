# controllers/files.controller.ts

**Archivo:** `src/controllers/files.controller.ts`
**Rol:** Controlador HTTP para todas las operaciones de archivos. Maneja la capa HTTP (códigos de estado, parámetros de URL, respuestas de error) y delega la lógica a `files.service`.

---

## Concepto: Separación Controller / Service

El controlador **no** sabe cómo leer el disco, calcular estadísticas, o sanitizar nombres. Solo sabe:
- Cómo extraer datos de la petición HTTP (`req.params`, `req.files`).
- Qué código de estado HTTP usar en cada caso.
- Cómo formatear la respuesta.

El servicio (`files.service.ts`) **no** sabe que está en un contexto HTTP. Solo trabaja con datos y el sistema de archivos.

Esta separación facilita testear cada capa independientemente.

---

## Función `uploadFiles`

```ts
export function uploadFiles(req: Request, res: Response): void {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files provided' });
      return;
    }

    const uploaded = filesService.processUploadedFiles(files);

    res.status(200).json({
      message: `${files.length} file(s) uploaded successfully`,
      files: uploaded,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload files' });
  }
}
```

Cuando llega aquí, Multer ya procesó los archivos y los guardó en disco. `req.files` es un array de objetos con metadatos (nombre en disco, tamaño, etc.).

- **`as Express.Multer.File[]`**: casteo de tipo necesario porque TypeScript no sabe si `req.files` es un array u otro formato (Multer tiene múltiples modos).
- Si no hay archivos: responde `400 Bad Request`.
- `processUploadedFiles` convierte los objetos de Multer al formato público de la API.

---

## Función `listFiles`

```ts
export function listFiles(_req: Request, res: Response): void {
  try {
    const files = filesService.listFiles();
    res.status(200).json({ files, count: files.length });
  } catch (err) {
    console.error('List files error:', err);
    res.status(500).json({ error: 'Failed to list files' });
  }
}
```

Lee el directorio de uploads y devuelve los metadatos de todos los archivos, ordenados del más nuevo al más viejo.

---

## Función `downloadFile`

```ts
export function downloadFile(req: Request, res: Response): void {
  // ...
  res.download(resolved.filePath, filename, (err) => {
    if (!err) return;
    const code = (err as NodeJS.ErrnoException).code ?? '';
    const msg = err.message ?? '';
    if (code === 'EPIPE' || code === 'ECONNRESET' || msg.includes('aborted')) {
      log.debug('files.controller.ts', 'Download interrupted by client', { filename });
      return;
    }
    log.error('files.controller.ts', 'Error al descargar archivo', { filename, error: String(err) });
    if (!res.headersSent) res.status(500).json({ error: 'Failed to download file' });
  });
}
```

### `res.download(filePath, filename, callback)`

Pone `Content-Disposition: attachment` y transmite el archivo en stream. El cliente recibe el archivo como descarga forzada.

### Manejo de EPIPE / ECONNRESET

Cuando el usuario cancela una descarga, el sistema operativo cierra el socket y Node.js reporta `EPIPE` o `ECONNRESET`. No son errores reales — se loguean en `debug` y se ignoran. Solo los errores inesperados escalan a `error`.

---

## Función `previewFile`

```ts
export function previewFile(req: Request, res: Response): void {
  // ...
  res.sendFile(resolved.filePath, (err) => { /* igual que download */ });
}
```

Variante de `downloadFile` que usa `res.sendFile()` en lugar de `res.download()`. La diferencia clave:

| Función | Header `Content-Disposition` | Efecto en el navegador |
|---------|------------------------------|------------------------|
| `res.download()` | `attachment` | Descarga forzada |
| `res.sendFile()` | ninguno | El browser decide (inline para PDF, video, audio, etc.) |

Lo usan los previsualizadores web y Tauri para embeber el archivo en `<iframe>`, `<video>` y `<audio>` sin que el navegador lo descargue.

---

## Función `deleteFile`

```ts
export function deleteFile(req: Request, res: Response): void {
  try {
    const filename = req.params.filename as string;

    let deleted: boolean;
    try {
      deleted = filesService.deleteFile(filename);
    } catch {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    if (!deleted) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.status(200).json({ message: `File "${filename}" deleted successfully` });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
}
```

Mismo patrón: captura el error de nombre inválido (400), verifica que el archivo exista (404), y devuelve éxito (200).

---

## Función `getStats`

```ts
export async function getStats(_req: Request, res: Response): Promise<void> {
  try {
    const stats = await filesService.getDiskStats();
    res.status(200).json(stats);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to get disk stats' });
  }
}
```

Es `async` porque `getDiskStats` es asíncrona (usa la librería `check-disk-space`).

---

## Códigos de estado HTTP usados

| Código | Significado | Cuándo |
|---|---|---|
| `200` | OK | Operación exitosa |
| `400` | Bad Request | El cliente envió datos inválidos (nombre con path traversal, sin archivos) |
| `404` | Not Found | El archivo solicitado no existe |
| `500` | Internal Server Error | Error inesperado del servidor |

---

## Logging

Todas las funciones usan `log` (de `../lib/logger`) en lugar de `console.*`. Esto garantiza salida estructurada con nivel, timestamp y contexto. Los errores de cliente/red (EPIPE, ECONNRESET, abortos) se loguean en `debug`, no en `error`, para no contaminar los logs con eventos normales.
