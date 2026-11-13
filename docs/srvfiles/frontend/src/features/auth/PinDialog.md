# PinDialog.tsx

**Archivo:** `frontend/src/features/auth/PinDialog.tsx`
**Rol:** Modal que pide el PIN de 6 dígitos de un servidor.

---

Se usa al abrir un servidor protegido y desde el selector de servidores. Dice dónde encontrar el PIN ("lo muestra la pantalla del equipo servidor") y deja la dirección como dato secundario. Se envía solo al completar los 6 dígitos (también al pegarlos o con `autocomplete="one-time-code"`). Sobre `Dialog`: con `onCancel` muestra el botón cerrar y Esc cancela; el clic fuera no cancela, para no perder lo escrito. Sin `onCancel` no se puede descartar.
