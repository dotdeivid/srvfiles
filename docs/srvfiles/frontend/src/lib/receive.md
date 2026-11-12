# receive.ts

**Archivo:** `frontend/src/lib/receive.ts`
**Rol:** Destino de un archivo recibido por P2P, escrito chunk a chunk.

---

- App de escritorio: archivo en `Descargas/SrvFiles` (comandos nativos `begin/append/finish/abort_receive`).
- Navegadores con File System Access API: el archivo que elige el usuario (`showSaveFilePicker`, debe llamarse desde el clic en Aceptar).
- Resto: en memoria y al final `triggerBrowserDownload(blob, name)`.
