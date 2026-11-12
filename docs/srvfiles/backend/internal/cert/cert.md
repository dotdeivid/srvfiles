# cert/cert.go

**Archivo:** `backend/internal/cert/cert.go`
**Rol:** Certificado TLS autofirmado para el servidor HTTPS de la LAN.

---

`GetOrCreateCert(certsDir, lanIPs)`:

- Reutiliza `cert.pem`/`key.pem` mientras falten más de 30 días para vencer y el certificado cubra todas las IPs actuales.
- Si no, genera uno nuevo:
  - número de serie aleatorio de 128 bits (un serial fijo hacía que Firefox rechazara el segundo servidor SrvFiles visitado: `SEC_ERROR_REUSED_ISSUER_AND_SERIAL`);
  - SAN con las IPs LAN, `127.0.0.1`, `::1`, `localhost` y el hostname;
  - clave ECDSA P-256, validez de 2 años;
  - clave privada con permisos `0600` (PKCS#8).

El navegador igual muestra el aviso de certificado autofirmado la primera vez.
