# OnlineClients.tsx

**Archivo:** `src/components/OnlineClients.tsx`
**Rol:** Panel que muestra los dispositivos conectados al mismo servidor y permite iniciar transferencias directas de archivos entre ellos.

---

## Componentes definidos en este archivo

| Componente | Descripción |
|---|---|
| `OnlineClients` | Contenedor: filtra la lista y renderiza una fila por dispositivo. |
| `DirectClientRow` | Fila individual para un dispositivo. Maneja el estado de transferencia. |

---

## Componente `OnlineClients`

### Props

```tsx
interface OnlineClientsProps {
  clients: TransferClient[];           // Todos los clientes conectados al servidor
  myClientId: string | null;           // El ID de este dispositivo (para excluirme de la lista)
  activeTransfer: ActiveTransfer | null; // Transferencia activa (si hay una)
  onSendFile: (toClientId, file, peerName) => void; // Iniciar envío
  onCancelTransfer: () => void;        // Cancelar la transferencia activa
  onViewServer?: (serverUrl) => void;  // Navegar a los archivos de un servidor Tauri
}
```

### Lógica

```tsx
const others = clients.filter((c) => c.clientId !== myClientId);
```

Filtra la lista para mostrar solo los otros dispositivos (no yo mismo).

```tsx
if (others.length === 0) {
  return <p>No hay otros dispositivos conectados al servidor.</p>;
}
```

Estado vacío: si no hay nadie más conectado, muestra un mensaje.

```tsx
return (
  <div className="online-clients__list">
    {others.map((client) => (
      <DirectClientRow key={client.clientId} client={client} ... />
    ))}
  </div>
);
```

Renderiza una `DirectClientRow` por cada dispositivo.

---

## Componente `DirectClientRow`

### Props

```tsx
interface DirectClientRowProps {
  client: TransferClient;
  activeTransfer: ActiveTransfer | null;
  onSendFile: (toClientId, file, peerName) => void;
  onCancel: () => void;
  onViewServer?: (serverUrl) => void;
}
```

### Lógica de estado por fila

```tsx
const isThisRow = activeTransfer?.peerId === client.clientId;
const isOtherRow = !!activeTransfer && !isThisRow;
```

- `isThisRow`: la transferencia activa involucra a **este** dispositivo.
- `isOtherRow`: hay una transferencia activa con **otro** dispositivo (esta fila debe deshabilitarse).

### Determinación del ícono de dispositivo

```tsx
const deviceIcon =
  client.deviceType === 'mobile' ? '📱' :
  client.isServer ? '🖥️' : '🌐';
```

Tres tipos:
- `📱`: app móvil (Flutter).
- `🖥️`: servidor Tauri de escritorio.
- `🌐`: navegador web.

### URL del servidor

```tsx
const serverUrl = `http://${client.ip}:3001`;
```

Si el dispositivo es un servidor Tauri, se construye su URL de backend para poder navegar a sus archivos.

### Renderizado condicional: ¿hay transferencia activa con esta fila?

#### Si `isThisRow === true` → muestra progreso

```tsx
{isThisRow && activeTransfer ? (
  <div className="direct-row__progress-area">
    {activeTransfer.waiting ? (
      <span>Esperando respuesta...</span>
    ) : (
      <>
        <div className="direct-row__bar" style={{ width: `${activeTransfer.progress}%` }} />
        <span>{activeTransfer.progress}%</span>
        <span>{formatBytes(activeTransfer.fileSize)}</span>
      </>
    )}
    <button onClick={onCancel}>✕</button>
  </div>
) : ...}
```

- `waiting: true`: el destinatario todavía no aceptó. Muestra "Esperando respuesta...".
- `waiting: false`: la transferencia comenzó. Muestra barra de progreso, porcentaje, y tamaño.
- Siempre muestra el botón de cancelar.

#### Si `isThisRow === false` → muestra acciones

```tsx
<div className="direct-row__actions">
  {client.isServer && onViewServer && (
    <button onClick={() => onViewServer(serverUrl)} disabled={isOtherRow}>
      Ver
    </button>
  )}
  <input ref={inputRef} type="file" style={{ display: 'none' }}
    onChange={(e) => {
      const file = e.target.files?.[0];
      if (file) onSendFile(client.clientId, file, client.appName);
      e.target.value = '';  // Reset para poder seleccionar el mismo archivo de nuevo
    }}
  />
  <button onClick={() => inputRef.current?.click()} disabled={isOtherRow}>
    Enviar
  </button>
</div>
```

#### Truco del input file oculto

El botón "Enviar" no abre un diálogo de archivo directamente. En cambio:
1. Hay un `<input type="file">` oculto con `ref={inputRef}`.
2. El botón llama a `inputRef.current?.click()` para disparar ese input.
3. Cuando el usuario selecciona un archivo, `onChange` llama a `onSendFile`.

Esto permite tener estilos completamente personalizados en el botón, ya que el botón nativo de "seleccionar archivo" es difícil de estilizar.

El `e.target.value = ''` limpia el input después de cada selección, permitiendo seleccionar el mismo archivo varias veces seguidas (si no se limpia, `onChange` no se dispara la segunda vez).
