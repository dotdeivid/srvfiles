# auth.controller.ts

**Archivo:** `src/features/auth/auth.controller.ts`
**Rol:** Controlador del endpoint `POST /api/auth`. Aplica rate limiting por IP, valida el PIN y devuelve un token de sesión si es correcto.

---

## `authenticate`

```ts
export function authenticate(req: Request, res: Response): void {
  const rawIp = (req.socket.remoteAddress ?? '').replace('::ffff:', '');
  const ip = rawIp === '::1' ? '127.0.0.1' : rawIp;

  if (checkRateLimit(ip).blocked) {
    res.status(429).json({ error: 'Demasiados intentos. Intentá de nuevo en 60 segundos.' });
    return;
  }

  const { pin } = req.body as { pin?: string };
  if (!pin || typeof pin !== 'string') {
    res.status(400).json({ error: 'PIN requerido' });
    return;
  }

  if (validatePin(pin)) {
    clearFailedAttempts(ip);
    res.json({ token: createSession() });
  } else {
    recordFailedAttempt(ip);
    res.status(401).json({ error: 'PIN incorrecto' });
  }
}
```

### Flujo paso a paso

1. **Normalización de IP**: se elimina el prefijo IPv4-mapped `::ffff:` y se normaliza `::1` (IPv6 loopback) a `127.0.0.1` para que loopback IPv4 e IPv6 compartan el mismo contador de rate limit.

2. **Rate limit**: si la IP está bloqueada, se responde `429` inmediatamente sin siquiera leer el body.

3. **Validación del body**: el PIN debe existir y ser un string. Sin esto, un atacante podría enviar `{ pin: null }` o `{ pin: 123 }` y causar comparaciones inesperadas.

4. **Validación del PIN**: si es correcto, se limpian los intentos fallidos y se devuelve un token UUID. Si es incorrecto, se registra el intento y se responde `401`.

### Respuestas

| Código | Condición | Body |
|--------|-----------|------|
| `200` | PIN correcto | `{ token: "uuid-v4" }` |
| `400` | PIN ausente o no string | `{ error: "PIN requerido" }` |
| `401` | PIN incorrecto | `{ error: "PIN incorrecto" }` |
| `429` | IP bloqueada por rate limit | `{ error: "Demasiados intentos..." }` |
