# transfer/session.go

**Archivo:** `internal/transfer/session.go`
**Rol:** Implementa el intercambio de claves ECDH P-256 y el cifrado AES-256-GCM por sesión WebSocket. Cada conexión tiene su propia instancia de `WsSession` con claves efímeras. Equivalente a `session.ts`.

---

## `SessionCipher`

```go
type SessionCipher struct {
    key []byte // 32 bytes (AES-256)
}

func (c *SessionCipher) EncryptJSON(plaintext string) (ivB64, dataB64 string, err error)
func (c *SessionCipher) DecryptJSON(ivB64, dataB64 string) (string, error)
func (c *SessionCipher) EncryptBinary(payload []byte) ([]byte, error)
func (c *SessionCipher) DecryptBinary(data []byte) ([]byte, error)
```

Wrapper sobre la clave AES-256-GCM derivada. Cuatro operaciones simétricas:

### `EncryptJSON` / `DecryptJSON`

Para mensajes de señalización JSON. El IV de 12 bytes se genera con `crypto/rand` en cada cifrado. Se devuelve como base64 junto al ciphertext para que el receptor pueda reconstruirlo.

```go
iv := make([]byte, gcm.NonceSize()) // 12 bytes
rand.Read(iv)
ciphertext := gcm.Seal(nil, iv, []byte(plaintext), nil)
```

### `EncryptBinary` / `DecryptBinary`

Para chunks de archivos. El IV se prepende directamente al buffer cifrado (`[12B IV || ciphertext]`), sin base64. El receptor separa los primeros 12 bytes como IV y el resto como ciphertext.

```go
// Cifrado
return append(iv, gcm.Seal(nil, iv, payload, nil)...), nil

// Descifrado
iv, ciphertext := data[:12], data[12:]
return gcm.Open(nil, iv, ciphertext, nil)
```

---

## `WsSession`

```go
type WsSession struct {
    Cipher *SessionCipher // nil hasta que HandleKeyExchange completa
}
```

### `HandleKeyExchange`

```go
func (s *WsSession) HandleKeyExchange(clientPubKeyB64 string) (string, error) {
    clientPubBytes, _ := base64.StdEncoding.DecodeString(clientPubKeyB64)
    curve := ecdh.P256()

    clientPubKey, _ := curve.NewPublicKey(clientPubBytes)
    serverPrivKey, _ := curve.GenerateKey(rand.Reader)    // par efímero

    sharedSecret, _ := serverPrivKey.ECDH(clientPubKey)  // 32 bytes

    // HKDF-SHA-256: misma salt/info que el cliente TypeScript/Flutter
    hkdfReader := hkdf.New(sha256.New, sharedSecret, nil, []byte("srvfiles-ws-v1"))
    aesKey := make([]byte, 32)
    io.ReadFull(hkdfReader, aesKey)

    s.Cipher = &SessionCipher{key: aesKey}
    return base64.StdEncoding.EncodeToString(serverPrivKey.PublicKey().Bytes()), nil
}
```

Implementa el lado servidor del protocolo ECDH:

1. **Decodifica la clave pública del cliente** (punto no comprimido P-256, base64).
2. **Genera un par de claves efímero** con `crypto/ecdh` (stdlib desde Go 1.20). El par es único por sesión.
3. **Computa el secreto compartido** con `ECDH`. El secreto es idéntico en ambos lados sin que ninguno envíe su clave privada.
4. **HKDF-SHA-256** (`golang.org/x/crypto/hkdf`) deriva 32 bytes de AES key del secreto compartido. `info = "srvfiles-ws-v1"` es el contexto de dominio que distingue esta clave de otras posibles derivaciones del mismo secreto.
5. **Devuelve la clave pública del servidor** en base64 para que el cliente realice el mismo proceso y derive la misma clave AES.

### Forward secrecy

Un par ECDH nuevo por sesión garantiza **forward secrecy**: si una clave de sesión se compromete, las sesiones anteriores y futuras siguen seguras porque usan pares diferentes.

### Compatibilidad con TypeScript y Flutter

El cliente web usa `webcrypto.subtle` (Web Crypto API) con los mismos parámetros. La app Flutter usa `pointycastle`. Los tres llegan al mismo secreto porque ECDH P-256 + HKDF-SHA-256 con `info = "srvfiles-ws-v1"` es determinista dado el mismo par de claves públicas.
