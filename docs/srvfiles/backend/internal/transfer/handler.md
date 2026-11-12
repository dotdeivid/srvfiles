# transfer/handler.go

**Archivo:** `backend/internal/transfer/handler.go`
**Rol:** Relay WebSocket de transferencias P2P (`GET /ws`). Ver `docs/protocol.md`.

---

## Conexión

- `SetReadLimit` (~260 KB), 10 s para mandar `auth`, después plazo de lectura renovado por cada pong.
- Con la clave del canal establecida, los mensajes en claro se rechazan.
- Mensajes antes de autenticar o con token inválido → cierre 4401.

## Señalización

| Mensaje | Regla |
|---|---|
| `key-exchange` | Cifrado del canal (`WsSession.HandleKeyExchange`). La respuesta sale en claro y después se activa la clave. |
| `hello` | Registra el cliente (máx. 100; nombre de hasta 64 caracteres). `e2e: 1` indica soporte de cifrado de extremo a extremo; `isServer`/`serverPort` lo usa la app de escritorio. |
| `send-request` | Exige `e2e.publicKey` válida (si no, `send-reject` `e2e-required`), destino conectado (`offline`), destino con E2E (`e2e-unsupported`) y `transferId` libre (`duplicate`). Reenvía la clave del emisor. |
| `send-key` | Solo del receptor, una vez: reenvía su clave pública al emisor. |
| `send-accept` | Solo del receptor y solo después de `send-key`. |
| `send-reject` / `send-cancel` | Reenvía al otro extremo y elimina la transferencia. |
| `send-complete` | Solo del emisor; reenvía el marcador final cifrado `e2e.final`. |

`relayBinary()` reenvía un chunk solo si viene del emisor de esa transferencia y ya fue aceptada. El servidor descifra/recifra la capa del canal pero **no puede** descifrar la capa E2E.

`cleanup()` al desconectarse: elimina el cliente, cancela sus transferencias y avisa al otro extremo.
