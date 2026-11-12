# signal.ts

**Archivo:** `frontend/src/lib/signal.ts`
**Rol:** Señal de aborto con timeout.

---

`timeoutSignal(ms, parent?)`: se aborta tras `ms` o con `parent`. Hecha a mano porque `AbortSignal.any`/`timeout` no existen en WebViews algo viejos.
