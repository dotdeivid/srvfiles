# files.controller.ts

**Archivo:** `src/features/files/files.controller.ts`
**Rol:** Controlador HTTP para todas las operaciones de archivos. Maneja la capa HTTP (códigos de estado, parámetros de URL, respuestas de error) y delega la lógica al servicio. Emite eventos WebSocket `files-changed` en operaciones que modifican el directorio.

---

## Concepto: Separación Controller / Service

El controlador no sabe cómo leer el disco ni calcular estadísticas. Solo sabe cómo extraer datos de `req`, qué código HTTP usar y cómo formatear la respuesta. El servicio (`files.service.ts`) no sabe que existe HTTP.

---

## `uploadFiles`

```ts
export function uploadFiles(req: Request, res: Response): void {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.status(400).json({ error: 'No files provided' });
    return;
  }
  const uploaded = filesService.processUploadedFiles(files);
  log.info('files.controller.ts', 'Files uploaded', { count: files.length, names: files.map((f) => f.originalname) });
  res.status(200).json({ message: `${files.length} file(s) uploaded successfully`, files: uploaded });
  broadcastFilesChanged();
}
```

Cuando llega aquí, Multer ya procesó los archivos y los guardó en disco. `req.files` es un array de objetos con metadatos. Después de responder, llama a `broadcastFilesChanged()` para notificar a todos los clientes WebSocket conectados.

---

## `listFiles`

```ts
export function listFiles(_req: Request, res: Response): void {
  const files = filesService.listFiles();
  res.status(200).json({ files, count: files.length });
}
```

Lee el directorio de uploads y devuelve los metadatos de todos los archivos, ordenados del más nuevo al más viejo.

---

## `downloadFile`

```ts
export function downloadFile(req: Request, res: Response): void {
  // ...
  res.download(resolved.filePath, filename, (err) => {
    if (!err) return;
    const code = (err as NodeJS.ErrnoException).code ?? '';
    const msg = err.message ?? '';
    if (code === 'EPIPE' || code === 'ECONNRESET' || msg.includes('aborted') || msg.includes('abort')) {
      log.debug('files.controller.ts', 'Download interrupted by client', { filename });
      return;
    }
    // ...
  });
}
```

`res.download()` pone `Content-Disposition: attachment` y transmite el archivo en stream (descarga forzada). Los errores `EPIPE` y `ECONNRESET` ocurren cuando el usuario cancela la descarga — son eventos normales que se loguean en `debug` y se ignoran.

---

## `previewFile`

```ts
export function previewFile(req: Request, res: Response): void {
  // ...
  res.sendFile(resolved.filePath, (err) => { /* igual que download */ });
}
```

Variante de `downloadFile` que usa `res.sendFile()` en lugar de `res.download()`:

| Función | Header `Content-Disposition` | Efecto en el navegador |
|---------|------------------------------|------------------------|
| `res.download()` | `attachment` | Descarga forzada |
| `res.sendFile()` | ninguno | El browser decide (inline para PDF, video, audio, etc.) |

Lo usan los previsualizadores web y Tauri para embeber el archivo en `<iframe>`, `<video>` y `<audio>` sin forzar descarga.

---

## `deleteFile`

```ts
export function deleteFile(req: Request, res: Response): void {
  // ...
  if (!deleted) { res.status(404).json({ error: 'File not found' }); return; }
  res.status(200).json({ message: `File "${filename}" deleted successfully` });
  broadcastFilesChanged();
}
```

Igual que upload: después de responder, emite `files-changed` para actualizar la lista en todos los clientes conectados.

---

## `getStats`

```ts
export async function getStats(_req: Request, res: Response): Promise<void> {
  const stats = await filesService.getDiskStats();
  res.status(200).json(stats);
}
```

Es `async` porque `getDiskStats` usa la librería `check-disk-space`, que es asíncrona.

---

## Códigos de estado HTTP

| Código | Cuándo |
|--------|--------|
| `200` | Operación exitosa |
| `400` | Nombre inválido, sin archivos |
| `404` | Archivo no encontrado |
| `500` | Error inesperado del servidor |
