# IncomingTransferModal.tsx

**Archivo:** `src/components/IncomingTransferModal.tsx`
**Rol:** Modal que aparece cuando otro dispositivo quiere enviarte un archivo por transferencia directa.

---

## Props

```tsx
interface IncomingTransferModalProps {
  request: IncomingTransferRequest | null;  // La solicitud entrante (null = no hay solicitud)
  onAccept: () => void;                     // Callback al aceptar
  onReject: () => void;                     // Callback al rechazar
}
```

La solicitud (`IncomingTransferRequest`) tiene:
- `fromName`: nombre del dispositivo que envía.
- `fileName`: nombre del archivo ofrecido.
- `fileSize`: tamaño en bytes.

---

## Función `IncomingTransferModal`

```tsx
export function IncomingTransferModal({ request, onAccept, onReject }) {
  if (!request) return null;
  ...
}
```

### Early return

Si `request` es `null` (no hay ninguna solicitud entrante activa), el componente no renderiza nada. Cuando alguien inicia una transferencia, `useTransfer` actualiza `incomingRequest` con los datos, lo que hace que este modal aparezca.

### Estructura del modal

```tsx
<div className="modal-overlay" onClick={onReject}>       {/* Clic en el fondo → rechazar */}
  <div className="modal transfer-modal" onClick={(e) => e.stopPropagation()}>
    <div className="modal__header">
      <h3>Archivo entrante</h3>
    </div>
    <div className="modal__body">
      {/* Quién envía */}
      <div className="transfer-modal__sender">
        <svg>...</svg>
        <span>{request.fromName}</span>
      </div>
      {/* Qué archivo */}
      <div className="transfer-modal__file">
        <svg>...</svg>
        <div>
          <span>{request.fileName}</span>
          <span>{formatBytes(request.fileSize)}</span>
        </div>
      </div>
      <p>¿Querés recibir este archivo?</p>
    </div>
    <div className="modal__footer">
      <button onClick={onReject}>Rechazar</button>
      <button onClick={onAccept}>Aceptar</button>
    </div>
  </div>
</div>
```

- Hacer clic en el **overlay** (fondo oscuro) llama a `onReject`, interpretándolo como un rechazo implícito.
- `stopPropagation()` evita que el clic dentro del modal llegue al overlay.
- Se muestran el nombre del remitente, el nombre del archivo, y su tamaño formateado.

---

## ¿Cómo se conecta con el resto de la app?

En `App.tsx`:

```tsx
<IncomingTransferModal
  request={incomingRequest}   // Viene de useTransfer
  onAccept={acceptTransfer}   // Llama a conn.accept(transferId) y prepara el buffer
  onReject={handleRejectTransfer}  // Llama a conn.reject(transferId) + toast
/>
```

El ciclo completo:
1. El servidor envía un mensaje `send-request` vía WebSocket.
2. `useTransfer` captura ese mensaje y actualiza `incomingRequest`.
3. `IncomingTransferModal` aparece mostrando la info del archivo.
4. El usuario hace clic en "Aceptar" → `acceptTransfer()` → el servidor notifica al remitente para que empiece a enviar chunks.
5. O hace clic en "Rechazar" → `rejectTransfer()` → el servidor notifica al remitente.
