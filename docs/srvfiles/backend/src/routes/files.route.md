# routes/files.route.ts

**Archivo:** `src/routes/files.route.ts`
**Rol:** Define las rutas HTTP para el manejo de archivos. Conecta los endpoints con sus middlewares y controladores.

---

## Concepto: Router de Express

Un `Router` es como una mini-aplicación Express que agrupa rutas relacionadas. Se monta en `app.use('/api/files', filesRouter)` en `index.ts`, lo que hace que todas las rutas aquí definidas sean relativas a `/api/files`.

---

## Rutas definidas

```ts
router.post('/upload', upload.array('files', MAX_UPLOAD_COUNT), filesController.uploadFiles);
router.get('/', filesController.listFiles);
router.get('/download/:filename', filesController.downloadFile);
router.get('/preview/:filename', filesController.previewFile);
router.get('/stats', filesController.getStats);
router.delete('/:filename', filesController.deleteFile);
```

| Método | Ruta completa | Middleware | Controlador |
|---|---|---|---|
| POST | `/api/files/upload` | `upload.array('files', 50)` | `uploadFiles` |
| GET | `/api/files/` | — | `listFiles` |
| GET | `/api/files/download/:filename` | — | `downloadFile` |
| GET | `/api/files/preview/:filename` | — | `previewFile` |
| GET | `/api/files/stats` | — | `getStats` |
| DELETE | `/api/files/:filename` | — | `deleteFile` |

### `/download/:filename` vs `/preview/:filename`

Ambas rutas sirven el mismo archivo pero con comportamiento distinto:
- `/download/`: `Content-Disposition: attachment` — fuerza descarga.
- `/preview/`: sin ese header — el navegador decide cómo mostrar el archivo (inline para PDF, video, audio, etc.). Lo usa el previsualizador web/Tauri.

### Parámetros de ruta (`:filename`)

Los segmentos de ruta que empiezan con `:` son parámetros variables. `GET /api/files/download/foto.jpg` pone `"foto.jpg"` en `req.params.filename`.

### `/download/:filename` vs `/:filename`

Express evalúa las rutas en orden de registro. `/download/:filename` se registra **antes** que `/:filename`, así que `GET /download/foto.jpg` siempre va a `downloadFile`, no a `listFiles` u otro handler.

### `upload.array('files', MAX_UPLOAD_COUNT)`

La ruta de upload tiene un middleware de Multer intercalado entre la definición de la ruta y el controlador. Express los ejecuta en secuencia:

```
petición → upload.array(...) → filesController.uploadFiles → respuesta
```

Si Multer falla (archivo demasiado grande, etc.), llama a `next(err)` y el controlador nunca se ejecuta.

---

## Principio de responsabilidad única

Este archivo **solo** conecta URLs con handlers. No contiene lógica de negocio. Eso vive en los controladores y servicios.
