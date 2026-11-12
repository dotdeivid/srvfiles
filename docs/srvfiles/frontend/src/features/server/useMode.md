# useMode.ts

**Archivo:** `frontend/src/features/server/useMode.ts`
**Rol:** Decide a qué servidor conectarse.

---

- App de escritorio: el backend propio, en el puerto que eligió la app (`getBackendPort`).
- Navegador: el servidor que sirvió la página (origen actual).
- `localUrl` = backend de esta máquina/página (para escanear la red); `serverUrl` = servidor que se está viendo.
- `connect(url)` con historial, `goBack()`, `canGoBack`, `rescan()`.
