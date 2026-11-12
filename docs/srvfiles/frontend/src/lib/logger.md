# logger.ts

**Archivo:** `frontend/src/lib/logger.ts`
**Rol:** Logger del frontend.

---

`log.error/warn/info/debug(msg, meta?)`: en la app de escritorio va a `tauri-plugin-log` (archivo), en el navegador a la consola. El plugin se carga de forma perezosa.
