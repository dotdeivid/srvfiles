# main.tsx

**Archivo:** `frontend/src/main.tsx`
**Rol:** Punto de entrada del frontend.

---

- Importa las tipografías Inter y Outfit empaquetadas (`@fontsource`): funcionan sin internet y no revelan la IP a terceros.
- Registra `unhandledrejection` y `error` globales hacia `log`.
- Monta `<App />` dentro de `StrictMode` y `ErrorBoundary`.
