# auth.service.ts

**Archivo:** `frontend/src/features/auth/auth.service.ts`
**Rol:** Tokens de sesión por servidor y llamadas de autenticación.

---

- Tokens en `sessionStorage`, **uno por servidor** (clave = origen `http://host:puerto`): `getToken`, `setToken`, `clearToken`, `onTokenCleared(baseUrl, cb)` (evento al borrar, p. ej. tras un 401).
- `authenticate(baseUrl, pin)` → `POST /api/auth`; resultado `ok` / PIN incorrecto / demasiados intentos (429) / error de red.
- `fetchLocalPin(baseUrl)` → `GET /api/pin` con timeout de 5 s; solo responde el servidor de esta máquina. `null` si no está disponible.
