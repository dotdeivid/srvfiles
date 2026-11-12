# OnlineClients.tsx

**Archivo:** `frontend/src/features/transfer/OnlineClients.tsx`
**Rol:** Lista de dispositivos conectados para enviar archivos.

---

- Por fila: nombre, tipo, IP, botón de enviar (selector de archivo), estado.
- Mientras se espera la respuesta muestra el código de verificación que el receptor debe confirmar.
- Envío deshabilitado si este navegador no tiene contexto seguro (`e2eAvailable`) o si el destino no soporta E2E (`client.e2e`), con el motivo.
- Los servidores muestran un acceso para abrir sus archivos (`serverUrlFor`).
