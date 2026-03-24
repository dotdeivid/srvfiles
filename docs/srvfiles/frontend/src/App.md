# App.tsx

**Archivo:** `src/App.tsx`
**Rol:** Componente raíz. Orquesta toda la lógica de la aplicación y decide qué pantalla mostrar.

---

## Estructura general

`App.tsx` define **tres componentes**:

| Componente | Descripción |
|---|---|
| `App` | Componente raíz. Detecta si el servidor ya está listo y decide qué mostrar. |
| `ConnectingScreen` | Pantalla de carga mientras se busca el servidor. |
| `FileApp` | La UI principal con archivos, transferencias, header, modales, etc. |

---

## Componente `App`

```tsx
function App() {
  const { serverUrl, connecting, connect, rescan } = useMode();

  if (connecting) {
    return <ConnectingScreen />;
  }

  return <FileApp serverUrl={serverUrl!} onConnect={connect} onRescan={rescan} />;
}
```

### ¿Qué hace?

1. Llama al hook `useMode()` para saber el estado de conexión al servidor backend.
2. Mientras `connecting === true` (el servidor todavía no fue encontrado), muestra `<ConnectingScreen />`.
3. Cuando `connecting` pasa a `false`, renderiza `<FileApp />` con la URL del servidor ya conocida.

### Concepto: hooks en React

Un **hook** es una función que comienza con `use` y le permite a un componente "engancharse" a estado, efectos, o lógica compartida. Acá `useMode()` devuelve variables reactivas: si `connecting` cambia, React vuelve a renderizar `App` automáticamente.

---

## Componente `ConnectingScreen`

```tsx
function ConnectingScreen() {
  return (
    <div className="connecting-screen">
      <div className="connecting-screen__spinner" />
      <p className="connecting-screen__text">Buscando servidor...</p>
    </div>
  );
}
```

Componente puramente visual: muestra un spinner y texto. No tiene lógica ni estado propio.

---

## Componente `FileApp`

Es la parte más grande del archivo. Recibe tres props:

| Prop | Tipo | Descripción |
|---|---|---|
| `serverUrl` | `string` | URL del backend activo (ej: `http://192.168.1.5:3001`). |
| `onConnect` | `(url) => void` | Función para cambiar de servidor. |
| `onRescan` | `() => Promise<DiscoveredServer[]>` | Función para escanear la red de nuevo. |

### Hooks usados

```tsx
const { files, stats, config, loading, uploading, uploadProgress, error, upload, remove, getDownloadUrl } = useFiles(serverUrl);
const { deviceName, showNameModal, saveName } = useDeviceName();
const { myClientId, onlineClients, incomingRequest, activeTransfer, sendFileTo, acceptTransfer, rejectTransfer, cancelTransfer, rename } = useTransfer(...);
```

- **`useFiles`**: Maneja la lista de archivos, el estado de carga, y las operaciones de subir/borrar.
- **`useDeviceName`**: Maneja el nombre del dispositivo (guardado en `localStorage`).
- **`useTransfer`**: Maneja la conexión WebSocket para transferencias directas entre dispositivos.

### Estado local

```tsx
const [switcherOpen, setSwitcherOpen] = useState(false);
const [confirmOpen, setConfirmOpen] = useState(false);
const [pendingDelete, setPendingDelete] = useState<string | null>(null);
```

- `switcherOpen`: controla si el modal de cambio de servidor está abierto.
- `confirmOpen` + `pendingDelete`: controlan el modal de confirmación de borrado. `pendingDelete` guarda el nombre del archivo que se quiere borrar.

### Concepto: `useState`

`useState(valorInicial)` devuelve `[valorActual, funcionParaCambiarElValor]`. Cuando la función cambia el valor, React vuelve a renderizar el componente con el nuevo valor.

### Funciones de manejo

#### `handleFileReceived`

```tsx
const handleFileReceived = useCallback(
  async (fileName, _mimeType, blob) => {
    const savedPath = await saveReceivedFile(fileName, blob);
    toast.success(savedPath ? `"${fileName}" guardado en Descargas/SrvFiles` : `"${fileName}" recibido`);
  },
  []
);
```

Se ejecuta cuando este dispositivo **recibe** un archivo completo por transferencia directa. Guarda el archivo en disco (en Tauri) o lo descarga (en el navegador), y muestra una notificación de éxito.

#### `handleSaveName`

```tsx
const handleSaveName = useCallback((name: string) => {
  saveName(name);
  const trimmed = name.trim();
  if (trimmed) rename(trimmed);
}, [saveName, rename]);
```

Cuando el usuario guarda su nombre de dispositivo: primero lo persiste en `localStorage` (vía `saveName`), y luego lo notifica al servidor WebSocket (vía `rename`) para que otros dispositivos vean el nombre nuevo.

#### `handleRequestDelete`

```tsx
const handleRequestDelete = useCallback((filename: string) => {
  setPendingDelete(filename);
  setConfirmOpen(true);
}, []);
```

Cuando el usuario hace clic en el botón de borrar de un archivo: guarda el nombre del archivo en `pendingDelete` y abre el modal de confirmación. El archivo no se borra todavía.

#### `handleConfirmDelete`

```tsx
const handleConfirmDelete = useCallback(async () => {
  if (!pendingDelete) return;
  setConfirmOpen(false);
  const success = await remove(pendingDelete);
  if (success) toast.success(`"${pendingDelete}" eliminado`);
  else toast.error(`Error al eliminar "${pendingDelete}"`);
  setPendingDelete(null);
}, [pendingDelete, remove]);
```

Se ejecuta cuando el usuario confirma el borrado en el modal. Llama a `remove()` del hook `useFiles` para hacer el DELETE al backend, muestra una notificación según el resultado, y limpia el estado.

#### `handleCancelDelete`

```tsx
const handleCancelDelete = useCallback(() => {
  setConfirmOpen(false);
  setPendingDelete(null);
}, []);
```

Cierra el modal de confirmación sin borrar nada.

#### `handleRejectTransfer`

```tsx
const handleRejectTransfer = useCallback(() => {
  rejectTransfer();
  toast.error('Transferencia rechazada');
}, [rejectTransfer]);
```

Rechaza una transferencia entrante y muestra una notificación.

### Variables derivadas

```tsx
const appName = config?.appName || import.meta.env.VITE_APP_NAME || 'SrvFiles';
const otherClients = onlineClients.filter((c) => c.clientId !== myClientId);
const serverClients = onlineClients.filter((c) => c.isServer && c.clientId !== myClientId);
const webUrl = config?.lanIp ? `http://${config.lanIp}:${config.frontendPort}` : null;
const backendLanUrl = config?.lanIp ? `http://${config.lanIp}:${config.port}` : serverUrl;
```

- `appName`: nombre a mostrar en el header. Se obtiene del servidor; si no hay config, usa una variable de entorno o el valor por defecto.
- `otherClients`: lista de todos los dispositivos conectados excepto yo mismo.
- `serverClients`: solo los dispositivos que son servidores Tauri (para el chip del header).
- `webUrl`: URL del frontend con IP LAN real (para el chip del header y el QR).
- `backendLanUrl`: URL del backend con IP LAN real (para mostrar en el modal, evita que aparezca "localhost").

### JSX retornado

El componente usa un **Fragment** (`<>...</>`) como contenedor raíz, lo que le permite tener dos elementos hermanos sin un `<div>` extra:

1. **Toaster + modales** (sin posición fija en el flujo):
   - `<Toaster>`: sistema de notificaciones (sonner).
   - `<NameModal>`: aparece al primer uso para pedir el nombre.
   - `<IncomingTransferModal>`: aparece cuando alguien quiere enviarte un archivo.
   - `<ServerSwitcherModal>`: modal para cambiar de servidor.
   - `<ConfirmModal>`: modal para confirmar borrado.

2. **`<header>`**: barra superior con el nombre de la app, el chip de IP/servidor, y el indicador de disco. Al estar **fuera del `<div className="app">`**, ocupa el 100% del ancho de la ventana sin trucos CSS.

3. **`<div className="app">`**: contenedor principal con `max-width` y padding. Contiene:
   - Banner de error (si hay).
   - `<DropZone>`: zona de drag & drop para subir archivos.
   - Panel de clientes conectados (aparece animado cuando hay otros dispositivos).
   - `<FileList>`: la lista/grilla de archivos.
   - `<QRFooter>`: pie con QR para acceso mobile.

### Concepto: `useCallback`

`useCallback(fn, [deps])` memoriza una función. Sin esto, cada vez que `FileApp` se re-renderiza, React crearía una nueva instancia de la función, lo que podría causar re-renders innecesarios en los componentes hijos que reciben esa función como prop.
