# OnlineClients.tsx

**Archivo:** `frontend/src/features/transfer/OnlineClients.tsx`
**Rol:** Lista de dispositivos conectados para enviar archivos.

---

- Por fila: nombre, tipo, IP, botón de enviar (selector de archivo), estado.
- Mientras se espera la respuesta, la fila muestra "Esperando que {receptor} confirme…" y, debajo y a todo el ancho, el código de verificación en grande (`.sas-panel--inline`, el mismo panel que el diálogo del receptor) para que los dos lo comparen.
- Envío deshabilitado si este navegador no tiene contexto seguro (`e2eAvailable`) o si el destino no soporta E2E (`client.e2e`), con el motivo.
- Los servidores muestran un acceso para abrir sus archivos (`serverUrlFor`).
