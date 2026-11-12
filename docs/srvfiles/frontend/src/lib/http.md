# http.ts

**Archivo:** `frontend/src/lib/http.ts`
**Rol:** `fetch` contra el backend con token, timeout y errores en español.

---

- Errores: `AuthError` (401), `ApiError` (mensaje mostrable + estado), `CancelledError`.
- `messageForStatus`, `errorMessage`.
- `apiFetch(baseUrl, path, opts)`: cabecera `X-SrvFiles-Token` del servidor, timeout (`timeoutSignal`); un 401 borra el token de ese servidor y lanza `AuthError`.
- `uploadWithProgress`: multipart con `XMLHttpRequest` (progreso y cancelación).
