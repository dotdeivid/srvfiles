# Protocolo WebSocket de SrvFiles (v2)

Contrato común entre el backend Go (`backend/internal/transfer`), el frontend web (`frontend/src/features/transfer`, `frontend/src/lib/e2e.ts`) y la app móvil (`srvfiles_mobile/lib/services/transfer_service.dart`, `e2e_service.dart` y `relay/relay_ws_handler.dart`). Cualquier cambio tiene que aplicarse en los tres y mantener los vectores de [`e2e-test-vectors.json`](e2e-test-vectors.json).

Hay dos capas de cifrado independientes:

| Capa | Entre | Para qué |
|---|---|---|
| **Canal** | cada cliente ↔ servidor/relay | Protege toda la señalización (nombres, IPs, solicitudes) en la red local. |
| **Extremo a extremo (E2E)** | emisor ↔ receptor | Protege el contenido del archivo. El servidor/relay **no puede** descifrarlo. Obligatoria desde v2. |

## Conexión

`GET /ws`. Navegadores: solo desde orígenes permitidos (la propia página, la app de escritorio, Vite en `localhost:5173`). Clientes nativos no mandan `Origin`.

Límites del servidor Go: mensajes de hasta ~260 KB, 100 clientes, nombre de dispositivo de 64 caracteres, 10 s para autenticarse. El servidor manda ping cada 25 s y corta si no hay pong en 60 s.

## Secuencia de conexión

1. **Cliente → `auth`** `{ "type": "auth", "token": "<token de POST /api/auth>" }`
   - Token inválido → el servidor cierra con código **4401** (el cliente debe pedir el PIN).
   - El relay móvil sin modo servidor manda `auth_ok` apenas se conecta; si después recibe `auth` no lo repite. El cliente ignora `auth_ok` duplicados.
2. **Servidor → `auth_ok`**.
3. **Cifrado del canal (opcional)** — si el cliente tiene WebCrypto/criptografía disponible:
   - Cliente → `{ "type": "key-exchange", "publicKey": "<base64 de 65 bytes: 0x04‖x‖y, P-256>" }` (en claro).
   - Servidor → `{ "type": "key-exchange", "publicKey": "..." }` (en claro) o `{ "type": "key-exchange-error" }`.
   - Clave: ECDH P-256 → secreto de 32 bytes (coordenada x) → HKDF-SHA-256 (salt vacío, info `srvfiles-ws-v1`) → AES-256-GCM.
   - El cliente espera la respuesta como mucho **5 s**; sin respuesta sigue sin cifrar el canal.
   - Con la clave establecida, todo mensaje JSON va como `{ "type": "encrypted", "iv": "<base64 12 bytes>", "data": "<base64 ciphertext‖tag16>" }` y los frames binarios como `[IV 12][ciphertext][tag 16]`. Los mensajes en claro se descartan.
4. **Cliente → `hello`** `{ "type": "hello", "appName", "deviceType": "desktop"|"mobile", "e2e": 1, "isServer"?, "serverPort"? }`
   - `e2e: 1` declara soporte de cifrado de extremo a extremo (v2). Sin él, el cliente no puede enviar ni recibir.
5. **Servidor → `welcome`** `{ "clientId" }` y a todos **`clients`** `{ "clients": [{ clientId, appName, ip, deviceType, isServer, serverPort, receiving, e2e, isOwner? }] }`.

## Transferencia con cifrado de extremo a extremo

```
Emisor                         Servidor/relay                      Receptor
  │ send-request {e2e.publicKey A} ─▶ valida y reenvía ─────────────▶ │
  │                                                     deriva clave, │
  │ ◀──────────────────── reenvía ◀─ send-key {publicKey B} ──────────│ muestra código
  │ deriva clave, muestra código                                      │
  │                       (los usuarios comparan el código de 6 dígitos)
  │ ◀──────────────────── reenvía ◀─ send-accept ─────────────────────│ (solo tras confirmar)
  │ chunks [id 36][E2E(i)] ─────────▶ reenvía si emisor y aceptada ──▶ │ descifra con índice i
  │ send-complete {e2e.final} ──────▶ reenvía ───────────────────────▶ │ verifica y guarda
```

| Mensaje | Dirección | Campos |
|---|---|---|
| `send-request` | emisor → receptor | `to`, `transferId` (≤ 36 caracteres, lo genera el emisor), `fileName`, `fileSize`, `mimeType`, **`e2e.publicKey`** (clave efímera del emisor); al receptor llegan `from` y `fromName` |
| `send-key` | receptor → emisor | `transferId`, `publicKey` (clave efímera del receptor). Solo una vez por transferencia. |
| `send-accept` | receptor → emisor | `transferId`. El servidor lo ignora si antes no hubo `send-key`. |
| `send-reject` | receptor → emisor | `transferId`, `reason?` |
| `send-cancel` | cualquiera → el otro | `transferId` |
| `send-complete` | emisor → receptor | `transferId`, **`e2e.final`** (marcador final cifrado) |
| `files-changed` | servidor → todos | — |
| `set-receiving` | cliente → servidor | `receiving` |
| `rename` | cliente → servidor | `newName` |

### Derivación de la clave y código de verificación

```
shared = ECDH-P256(propia, del otro)                  (32 bytes, coordenada x)
okm    = HKDF-SHA-256(ikm = shared,
                      salt = UTF-8(transferId),
                      info = UTF-8("srvfiles-e2e-v1") ‖ pubEmisor(65) ‖ pubReceptor(65),
                      L = 36)
key    = okm[0..32]                                   → AES-256-GCM
SAS    = uint32_be(okm[32..36]) mod 1 000 000         → 6 dígitos, se muestra "123 456"
```

**Código de verificación (obligatorio):** el emisor lo ve mientras espera; el receptor lo ve en el diálogo de la solicitud y solo puede aceptar marcando que coincide. Si un intermediario (por ejemplo un relay malicioso) reemplazara las claves, los códigos serían distintos.

### Chunks y marcador final

- Frame binario (dentro del cifrado del canal, si lo hay): `[transferId ASCII, 36 bytes, relleno con espacios][AES-256-GCM(key, nonce(i), chunk, aad = UTF-8(transferId))]`, con `nonce(i) = 0x00000000 ‖ uint64_be(i)` e `i` = índice del chunk desde 0. Chunks de hasta 256 KB de datos.
- `e2e.final` = base64 de `AES-256-GCM(key, nonce(N), UTF-8(JSON {"chunks": N, "size": bytes, "name": nombre}), aad = UTF-8(transferId + "|end"))`, con N = cantidad de chunks.

**Integridad:** como cada chunk se autentica con su índice, un chunk alterado, repetido, reordenado o inyectado no se descifra. El marcador final autentica la cantidad de chunks, el tamaño y el nombre: el receptor descarta el archivo si no coinciden con lo recibido y con lo anunciado en `send-request`.

**Orden:** cada extremo procesa los mensajes de una conexión en orden (cola). Descifrar es asíncrono: sin cola, `send-complete` podría procesarse antes que los últimos chunks.

### Reglas del servidor/relay

- Rechaza `send-request` sin `e2e.publicKey` válida (`reason: "e2e-required"`) o hacia un cliente sin `e2e` (`"e2e-unsupported"`).
- Reenvía chunks solo si vienen del emisor de esa transferencia **y** el receptor mandó `send-key` y aceptó.
- Si un extremo se desconecta, elimina sus transferencias y manda `send-cancel` al otro.

Motivos de `send-reject`: `offline`, `duplicate` (`transferId` en uso), `invalid`, `busy` (el receptor ya tiene una transferencia), `timeout` (no respondió en 60 s), `e2e-required`, `e2e-unsupported`, `e2e-unavailable` (el receptor abrió la web por HTTP y no puede cifrar).

## Descargas y vistas previas por URL

El token de sesión **nunca** va en la URL. Para `<a href>`, `<img>` y `<video>` el cliente pide un token de enlace:

`POST /api/files/link {"name": "<archivo>"}` (con `X-SrvFiles-Token`) → `{"token", "expiresIn": 600}`

y usa `GET /api/files/download/<archivo>?dl=<token>` o `/api/files/preview/<archivo>?dl=<token>`. El token vale solo para ese archivo y durante 10 minutos (puede reutilizarse en ese plazo: el video pide rangos sucesivos). Lo implementan el backend Go y el modo servidor del móvil.

## Vectores de prueba

[`e2e-test-vectors.json`](e2e-test-vectors.json) contiene claves privadas fijas, las claves públicas, la clave derivada, el código y los cifrados esperados de dos chunks y del marcador final. Lo verifican:

- Go: `backend/internal/transfer/e2e_vectors_test.go` (copia en `testdata/`)
- Web: `frontend/src/lib/e2e.test.ts` (copia en `src/lib/e2e-vectors.json`)
- Móvil: `srvfiles_mobile/test/e2e_test.dart` (copia en `test/fixtures/`)

Además, los jobs `interop` de CI levantan el backend Go real y transfieren un archivo con el cliente web (`frontend/src/features/transfer/interop.test.ts`) y con el cliente móvil (`srvfiles_mobile/test/interop_test.dart`).
