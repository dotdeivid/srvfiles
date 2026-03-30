# files.route.ts

**Archivo:** `src/features/files/files.route.ts`
**Rol:** Define las rutas HTTP del feature de archivos. Conecta los endpoints con el middleware de Multer y los controladores.

---

```ts
router.post('/upload', upload.array('files', MAX_UPLOAD_COUNT), filesController.uploadFiles);
router.get('/', filesController.listFiles);
router.get('/download/:filename', filesController.downloadFile);
router.get('/preview/:filename', filesController.previewFile);
router.get('/stats', filesController.getStats);
router.delete('/:filename', filesController.deleteFile);
```

## Rutas definidas

| Método | Ruta completa | Middleware | Controlador |
|--------|---------------|------------|-------------|
| POST | `/api/files/upload` | `upload.array('files', 50)` | `uploadFiles` |
| GET | `/api/files/` | — | `listFiles` |
| GET | `/api/files/download/:filename` | — | `downloadFile` |
| GET | `/api/files/preview/:filename` | — | `previewFile` |
| GET | `/api/files/stats` | — | `getStats` |
| DELETE | `/api/files/:filename` | — | `deleteFile` |

Todas estas rutas están protegidas por `requireAuth` (montadas así en `app.ts`).

## `/download/:filename` vs `/preview/:filename`

Ambas sirven el mismo archivo pero con comportamiento distinto:
- `/download/`: `Content-Disposition: attachment` — fuerza descarga.
- `/preview/`: sin ese header — el navegador decide (inline para PDF, video, audio, etc.).

## `upload.array('files', MAX_UPLOAD_COUNT)`

La ruta de upload tiene un middleware de Multer intercalado. Express los ejecuta en secuencia:
```
petición → upload.array(...) → filesController.uploadFiles → respuesta
```
Si Multer rechaza (archivo demasiado grande, etc.), llama a `next(err)` y el controlador nunca se ejecuta.

## Orden de registro de rutas

Express evalúa rutas en orden de registro. `/download/:filename` y `/preview/:filename` se registran **antes** que `/:filename` para que nunca colisionen con el handler de delete.
