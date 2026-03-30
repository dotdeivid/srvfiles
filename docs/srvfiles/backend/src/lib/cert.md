# cert.ts

**Archivo:** `src/lib/cert.ts`
**Rol:** Gestiona el certificado TLS autofirmado para el servidor HTTPS. Carga el certificado existente del disco si está disponible, o genera uno nuevo y lo persiste.

---

## `getOrCreateCert`

```ts
export async function getOrCreateCert(certsDir: string): Promise<CertBundle> {
  const keyPath  = path.join(certsDir, 'key.pem');
  const certPath = path.join(certsDir, 'cert.pem');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    log.debug('cert.ts', 'Loading existing TLS certificate', { certsDir });
    return {
      key:  fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  }

  // Genera nuevo certificado autofirmado
  const pems = await selfsigned.generate(attrs, {
    keySize: 2048,
    keyType: 'rsa',
    notAfterDate: tenYears,
  });

  fs.mkdirSync(certsDir, { recursive: true });
  fs.writeFileSync(keyPath,  pems.private, { mode: 0o600 });
  fs.writeFileSync(certPath, pems.cert);

  return { key: Buffer.from(pems.private), cert: Buffer.from(pems.cert) };
}
```

### Parámetro

- **`certsDir`**: ruta al directorio donde se persisten los archivos `key.pem` y `cert.pem`. Viene de `CERTS_DIR` en `config/index.ts`.

### Comportamiento

1. **Si existen `key.pem` y `cert.pem`**: los carga y los devuelve sin regenerar. El certificado persiste entre reinicios del servidor.
2. **Si no existen**: genera un nuevo certificado RSA-2048/SHA-256 autofirmado con la librería `selfsigned`, válido por 10 años, con `commonName: 'SrvFiles'`. Lo guarda con permisos `0o600` (solo el propietario puede leer la clave privada) y devuelve el bundle.

### ¿Por qué autofirmado y no Let's Encrypt?

SrvFiles corre en una red local privada sin dominio público. Let's Encrypt requiere acceso HTTP desde internet para la verificación de dominio. Un certificado autofirmado es la única opción práctica. Los navegadores muestran una advertencia la primera vez — el usuario debe aceptarla manualmente.

### ¿Por qué 10 años de validez?

Para evitar que el certificado expire durante el uso normal. Al ser autofirmado en un contexto local, la renovación no aporta beneficios de seguridad reales.

### Tipo `CertBundle`

```ts
interface CertBundle {
  key: Buffer;
  cert: Buffer;
}
```

Forma que espera `https.createServer({ key, cert }, app)` de Node.js.
