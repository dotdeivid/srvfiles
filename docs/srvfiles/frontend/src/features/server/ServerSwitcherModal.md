# ServerSwitcherModal.tsx

**Archivo:** `frontend/src/features/server/ServerSwitcherModal.tsx`
**Rol:** Selector de servidores: descubiertos, dirección manual y enlace para compartir.

---

- Lista los servidores encontrados (reescaneo manual), marca el actual.
- En el navegador abre la web del otro servidor por HTTPS (`https://host:httpsPort`); en la app de escritorio cambia de servidor y pide el PIN con `PinDialog`.
- Campo para escribir una IP (`normalizeServerUrl`).
- Copiar la URL con `CopyButton`.
- Sobre `Dialog`: Esc, clic fuera y botón cerrar.
