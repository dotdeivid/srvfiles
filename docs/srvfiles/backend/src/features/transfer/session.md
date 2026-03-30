# session.ts

**Archivo:** `src/features/transfer/session.ts`
**Rol:** Implementa el intercambio de claves ECDH P-256 y el cifrado AES-256-GCM por sesión WebSocket. Cada conexión tiene su propia instancia de `WsSession` con claves efímeras.

---

## `SessionCipher`

```ts
export class SessionCipher {
  constructor(private readonly key: CryptoKey) {}

  async encryptJson(plaintext: string): Promise<{ iv: string; data: string }>
  async decryptJson(iv: string, data: string): Promise<string>
  async encryptBinary(payload: Buffer): Promise<Buffer>
  async decryptBinary(data: Buffer): Promise<Buffer>
}
```

Wrapper sobre la clave AES-256-GCM derivada. Provee cuatro operaciones:

### `encryptJson` / `decryptJson`

Para mensajes de señalización JSON. El resultado es un objeto `{ iv, data }` con los valores en base64. El IV (vector de inicialización) de 12 bytes se genera aleatoriamente en cada cifrado con `webcrypto.getRandomValues`.

### `encryptBinary` / `decryptBinary`

Para chunks de archivos binarios. El IV se prepende directamente al buffer cifrado (primeros 12 bytes), lo que permite extraerlo al descifrar con `data.subarray(0, 12)`.

---

## `WsSession`

```ts
export class WsSession {
  keyExchangeDone = false;
  cipher: SessionCipher | null = null;

  async handleKeyExchange(clientPublicKeyB64: string): Promise<string>
}
```

### `handleKeyExchange`

```ts
async handleKeyExchange(clientPublicKeyB64: string): Promise<string> {
  const serverKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey', 'deriveBits'],
  );
  // Importa la clave pública del cliente
  // Deriva bits compartidos ECDH
  // Convierte a clave HKDF y deriva AES-256-GCM
  this.cipher = new SessionCipher(aesKey);
  this.keyExchangeDone = true;
  // Devuelve la clave pública del servidor en base64
  return Buffer.from(serverPubKeyRaw).toString('base64');
}
```

Implementa el lado servidor del protocolo ECDH:

1. **Genera un par de claves ECDH P-256 efímero** para esta sesión. `false` en el parámetro `extractable` impide exportar la clave privada.

2. **Importa la clave pública del cliente** (recibida en el mensaje `key-exchange` como base64).

3. **Deriva bits compartidos** con `subtle.deriveBits` (ECDH). El secreto compartido es el mismo en ambos lados sin que ninguno envíe su clave privada.

4. **HKDF SHA-256** convierte los bits compartidos en una clave AES-256-GCM determinista usando el contexto `srvfiles-ws-v1` como `info`.

5. **Devuelve la clave pública del servidor** para que el cliente realice el mismo proceso y derive la misma clave AES.

### ¿Por qué claves efímeras?

Un par ECDH nuevo por sesión garantiza **forward secrecy**: si una clave de sesión se compromete, las sesiones anteriores y futuras siguen seguras.

### Implementación con `webcrypto`

Se usa `node:crypto`'s `webcrypto.subtle` (la Web Crypto API disponible en Node.js ≥ 19) para ser compatible con el mismo código que corre en el navegador/Flutter.
