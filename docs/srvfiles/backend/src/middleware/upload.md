# middleware/upload.ts

**Archivo:** `src/middleware/upload.ts`
**Rol:** Configura Multer para recibir archivos subidos por multipart/form-data, sanitizando sus nombres y guardándolos en el directorio de uploads.

---

## ¿Qué es un middleware en Express?

Un middleware es una función con la firma `(req, res, next) => void` que se ejecuta en la cadena de procesamiento de una petición HTTP. Puede leer/modificar `req` y `res`, y llamar a `next()` para pasar al siguiente middleware o al handler de la ruta.

Multer es un middleware especializado: intercepta peticiones multipart, extrae los archivos, los guarda en disco, y adjunta los metadatos a `req.files`.

---

## Directorio de uploads

```ts
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
```

- En modo normal: crea `{cwd}/uploads/`.
- En Tauri sidecar: usa `UPLOADS_DIR` del entorno (una ruta dentro del directorio de datos de la app).
- Si el directorio no existe, se crea automáticamente al iniciar el servidor. `{ recursive: true }` no falla si ya existe.

---

## Función `resolveConflict`

```ts
function resolveConflict(filepath: string, filename: string): string {
  if (!fs.existsSync(filepath)) return filename;

  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  return `${base}_${Date.now()}${ext}`;
}
```

Evita sobreescribir archivos existentes. Si ya hay un `foto.jpg`, el nuevo se guarda como `foto_1710640000000.jpg`.

- **`path.extname('foto.jpg')`** → `'.jpg'`
- **`path.basename('foto.jpg', '.jpg')`** → `'foto'`
- **`Date.now()`**: milisegundos desde el epoch Unix — es un número prácticamente único.

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

`multer.diskStorage` permite controlar exactamente cómo se guarda cada archivo:

- **`destination`**: dónde guardar. Siempre `UPLOADS_DIR`. Los callbacks de Multer siguen el patrón Node.js `(err, value)` — `cb(null, valor)` significa "sin error, usa este valor".

- **`filename`**: cómo nombrar el archivo. Pasos:
  1. Sanitiza el nombre original (`file.originalname`).
  2. Verifica si ya existe un archivo con ese nombre.
  3. Si hay conflicto, añade timestamp.
  4. Llama a `cb(null, nombreFinal)`.
  5. Si `sanitizeFilename` lanza un error (nombre con path traversal), lo pasa con `cb(err, '')`.

---

## Instancia de Multer

```ts
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
  },
});

export default upload;
```

- **`storage`**: la configuración de almacenamiento personalizada.
- **`fileSize`**: límite en bytes. `MAX_FILE_SIZE_MB * 1024 * 1024` convierte MB a bytes. Multer rechaza archivos que superen este límite.

---

## ¿Cómo se usa en la ruta?

```ts
// En files.route.ts:
router.post('/upload', upload.array('files', MAX_UPLOAD_COUNT), filesController.uploadFiles);
```

`upload.array('files', MAX_UPLOAD_COUNT)` es el middleware de Multer. Procesa hasta `MAX_UPLOAD_COUNT` archivos del campo `files` en el `FormData`. Cuando termina, llama a `next()` (que en este caso es `filesController.uploadFiles`), y `req.files` ya contiene los archivos procesados.

---

## Concepto: `multipart/form-data`

Es el `Content-Type` de las peticiones HTTP que contienen archivos. A diferencia de `application/json` (que es texto), multipart puede incluir datos binarios (los bytes del archivo). El frontend lo usa así:

```ts
const formData = new FormData();
files.forEach((f) => formData.append('files', f));
fetch('/api/files/upload', { method: 'POST', body: formData });
```
