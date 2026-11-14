# App.tsx

**Archivo:** `frontend/src/App.tsx`
**Rol:** Componente raíz: compone servidor, autenticación, archivos y transferencias.

---

## Flujo

1. `useMode()` decide `serverUrl` (servidor que se ve) y `localUrl` (backend de esta máquina).
2. `useAuth(serverUrl)` autentica; mientras pide el PIN, `useFiles` recibe `null` (pausado).
3. `useFiles` carga lista, espacio y configuración; `useTransfer` abre el WebSocket y refresca la lista con `files-changed`.
4. `useDeviceName` asigna un nombre aleatorio; `NameModal` permite cambiarlo.
5. En la app de escritorio llama a `checkForUpdates()` al montar.

## Valores derivados

- `isOwnServer`: app de escritorio viendo su propio backend.
- `webUrl`: `https://<lanIp>:<httpsPort>` (copiar enlace en el selector).
- `isHost`: este navegador es el propio equipo servidor (conoce el PIN). Solo ahí aparecen "Conectar un dispositivo" (header) y la tarjeta de invitación.
- `backendLanUrl`: `http://<lanIp>:<port>` para el selector de servidores.
- `otherClients` / `serverClients`: dispositivos conectados sin incluirse a sí mismo.

Pasa `e2eAvailable` a `OnlineClients` (sin contexto seguro no se puede enviar) y `getLinkedUrl` a la lista y la vista previa. El borrado (de uno o varios archivos; `pendingDelete` es una lista y se borran uno tras otro con un único aviso al final) se confirma con `ConfirmModal`, cuyo mensaje aclara que el archivo se elimina de la carpeta compartida para todos los dispositivos. A `IncomingTransferModal` le pasa el emisor (`sender`) buscado en la lista de conectados, para mostrar el ícono de su dispositivo.

## Estructura de la pantalla

1. **En tu red:** los otros dispositivos (`OnlineClients`). En el servidor, sin nadie conectado, una tarjeta invita a sumar uno (`ConnectDialog`). En un cliente sin otros dispositivos la sección no aparece.
2. **Carpeta compartida (N):** `DropZone` (compacta cuando ya hay archivos) y `FileList`.

Si `useTransfer` informa `serverStopped`, `FileApp` reemplaza toda la página por `ServerStoppedScreen` ("El servidor se detuvo", con "Reintentar" que recarga y, si hay historial, "Volver al servidor anterior"): una pestaña abierta por el usuario no se puede cerrar desde la página.

El header muestra el servidor, el nombre del dispositivo, el estado de la conexión con texto ("Cifrado", "Reconectando…") y, en el servidor, el botón "Conectar un dispositivo".
