# useAuth.ts

**Archivo:** `frontend/src/features/auth/useAuth.ts`
**Rol:** Estado de autenticación para el servidor actual.

---

- Servidor local (app de escritorio / localhost): lee el PIN y se autentica sola; siempre re-autentica porque un backend reiniciado invalida el token viejo.
- Servidor remoto con token guardado: lo usa.
- Si no: abre `PinDialog`. `submitPin(pin)` muestra el error correspondiente.
- Un 401 en cualquier petición borra el token (`onTokenCleared`) y reabre el diálogo.
