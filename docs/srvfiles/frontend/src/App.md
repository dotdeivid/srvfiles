# App.tsx

**Archivo:** `frontend/src/App.tsx`
**Rol:** Componente raíz: compone servidor, autenticación, archivos y transferencias.

---

## Flujo

1. `useMode()` decide `serverUrl` (servidor que se ve) y `localUrl` (backend de esta máquina).
2. `useAuth(serverUrl)` autentica; mientras pide el PIN, `useFiles` recibe `null` (pausado).
3. `useFiles` carga lista, espacio y configuración; `useTransfer` abre el WebSocket y refresca la lista con `files-changed`.
4. `useDeviceName` y `NameModal` en el primer inicio.
5. En la app de escritorio llama a `checkForUpdates()` al montar.

## Valores derivados

- `isOwnServer`: app de escritorio viendo su propio backend.
- `webUrl`: `https://<lanIp>:<httpsPort>` (QR y copiar enlace).
- `backendLanUrl`: `http://<lanIp>:<port>` para el selector de servidores.
- `otherClients` / `serverClients`: dispositivos conectados sin incluirse a sí mismo.

Pasa `e2eAvailable` a `OnlineClients` (sin contexto seguro no se puede enviar) y `getLinkedUrl` a la lista y la vista previa. El borrado se confirma con `ConfirmModal`, cuyo mensaje aclara que el archivo se elimina de la carpeta compartida para todos los dispositivos. A `IncomingTransferModal` le pasa el emisor (`sender`) buscado en la lista de conectados, para mostrar el ícono de su dispositivo.
