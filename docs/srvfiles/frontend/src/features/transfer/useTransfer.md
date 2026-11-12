# useTransfer.ts

**Archivo:** `frontend/src/features/transfer/useTransfer.ts`
**Rol:** Estado de las transferencias directas entre dispositivos.

---

## Envío

1. Genera un par E2E y manda `send-request` con la clave pública.
2. Al llegar `send-key` deriva la sesión y muestra el código (`activeTransfer.sas`).
3. Con `send-accept` llama a `sendFile`.

## Recepción

1. Al llegar `send-request` deriva la sesión, manda `send-key` de inmediato y encola la solicitud (`PendingRequest` con `sas`). Si ya hay una transferencia → `busy`; sin respuesta en 60 s → `timeout`; sin contexto seguro → `e2e-unavailable`.
2. `accept(id)` crea el destino (`createReceiveSink`, debe ser desde el clic) y manda `send-accept`.
3. Los chunks se descifran en orden (cadena de promesas, `nextIndex`) y se escriben a medida que llegan.
4. `send-complete`: descifra el marcador final y comprueba cantidad de chunks, tamaño (recibido = anunciado) y nombre; si no coincide descarta el archivo.

Además: reconexión con backoff, `rejectMessage` traduce los motivos de rechazo, `files-changed` → `onFilesChanged`. Devuelve `onlineClients`, `myClientId`, `activeTransfer`, `requests`, `e2eAvailable` y las acciones.
