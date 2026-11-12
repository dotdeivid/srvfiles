# useDeviceName.ts

**Archivo:** `frontend/src/shared/hooks/useDeviceName.ts`
**Rol:** Nombre del dispositivo en la lista de transferencias.

---

Lo lee de `localStorage`; si no hay, genera uno aleatorio en español ("Rápido Zorro") y pide confirmarlo. `saveName` guarda el nombre (vacío → conserva el aleatorio).
