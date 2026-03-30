# upload.middleware.ts

**Archivo:** `src/features/files/upload.middleware.ts`
**Rol:** Configura Multer para recibir archivos subidos por `multipart/form-data`, sanitizando sus nombres y resolviendo conflictos antes de guardarlos en el directorio de uploads.

---

## `resolveConflict` (función interna)

```ts
function resolveConflict(filepath: string, filename: string): string {
  if (!fs.existsSync(filepath)) return filename;

  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  return `${base}_${Date.now()}${ext}`;
}
```

Evita sobreescribir archivos existentes. Si ya hay un `foto.jpg` en disco, el nuevo se guarda como `foto_1710640000000.jpg`.

- `path.extname('foto.jpg')` → `'.jpg'`
- `path.basename('foto.jpg', '.jpg')` → `'foto'`
- `Date.now()`: milisegundos desde el epoch Unix, prácticamente único.

---

## Configuración de almacenamiento Multer

```ts
const storage: StorageEngine = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    try {
      let sanitized = sanitizeFilename(file.originalname);
      const targetPath = path.join(UPLOADS_DIR, sanitized);
      sanitized = resolveConflict(targetPath, sanitized);
      cb(null, sanitized);
    } catch (err) {
      cb(err as Error, '');
    }
  },
});
```

`multer.diskStorage` permite controlar cómo se guarda cada archivo. Los callbacks de Multer siguen el patrón Node.js `(err, value)`: `cb(null, valor)` significa "sin error, usa este valor".

**`filename`**: pasos para nombrar el archivo en disco:
1. Sanitiza el nombre original (`file.originalname`) para eliminar caracteres peligrosos.
2. Verifica si ya existe un archivo con ese nombre.
3. Si hay conflicto, añade timestamp.
4. Si `sanitizeFilename` lanza (path traversal), pasa el error a Multer con `cb(err, '')`.

---

## Instancia de Multer exportada

```ts
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
  },
});

export default upload;
```

`fileSize` es el límite en bytes. `MAX_FILE_SIZE_MB * 1024 * 1024` convierte MB a bytes. Multer rechaza archivos que superen este límite antes de escribirlos a disco.

---

## ¿Cómo se usa en la ruta?

```ts
// En files.route.ts:
router.post('/upload', upload.array('files', MAX_UPLOAD_COUNT), filesController.uploadFiles);
```

`upload.array('files', MAX_UPLOAD_COUNT)` procesa hasta `MAX_UPLOAD_COUNT` archivos del campo `files` del `FormData`. Cuando termina, llama a `next()` y `req.files` ya contiene los archivos procesados.
