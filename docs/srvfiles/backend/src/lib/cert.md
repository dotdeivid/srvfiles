# cert.go

**Archivo:** `internal/cert/cert.go`
**Rol:** Gestiona el certificado TLS autofirmado para el servidor HTTPS. Carga el certificado existente de disco o genera uno nuevo RSA-2048 válido por 10 años.

---

## `GetOrCreateCert`

```go
func GetOrCreateCert(certsDir string) (tls.Certificate, error)
```

Punto de entrada único. Recibe el directorio donde persisten `key.pem` y `cert.pem`.

### Carga del certificado existente

```go
if fileExists(keyPath) && fileExists(certPath) {
    return tls.LoadX509KeyPair(certPath, keyPath)
}
```

Si ambos archivos existen, los carga directamente con `tls.LoadX509KeyPair`. No verifica la fecha de expiración — se asume que el certificado de 10 años no va a expirar en el ciclo de vida de la app.

### Generación de un certificado nuevo

```go
privateKey, _ := rsa.GenerateKey(rand.Reader, 2048)

template := &x509.Certificate{
    SerialNumber: big.NewInt(1),
    Subject:      pkix.Name{CommonName: "SrvFiles"},
    NotBefore:    time.Now(),
    NotAfter:     time.Now().AddDate(10, 0, 0),
    KeyUsage:     x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
    ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
    BasicConstraintsValid: true,
}

certDER, _ := x509.CreateCertificate(rand.Reader, template, template, &privateKey.PublicKey, privateKey)
```

Genera una clave RSA-2048 con `crypto/rand` (segura criptográficamente). El certificado es autofirmado (la plantilla actúa como su propio emisor). `KeyUsage` y `ExtKeyUsage` son los mínimos necesarios para TLS server.

### Persistencia

```go
os.WriteFile(keyPath, keyPEM, 0600)   // Solo lectura del propietario
os.WriteFile(certPath, certPEM, 0644) // Legible por todos
```

La clave privada se guarda con permisos `0600` (solo lectura/escritura del propietario del proceso). El certificado público con `0644`. Equivale al comportamiento de `lib/cert.ts` en el backend Node.js.

---

## ¿Certificado autofirmado?

Los navegadores muestran una advertencia la primera vez que se conectan por HTTPS. El usuario debe aceptarla. Esto es inevitable para un servidor local sin dominio público — no se puede obtener un certificado Let's Encrypt para una IP de LAN. La alternativa sería añadir el certificado al trust store del sistema operativo, pero eso requiere permisos de administrador y es demasiado invasivo para una app de usuario.
