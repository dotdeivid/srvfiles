# auth.middleware.ts

**Archivo:** `src/features/auth/auth.middleware.ts`
**Rol:** Middleware Express que protege rutas privadas. Verifica que la petición lleve un token de sesión válido antes de continuar al router correspondiente.

---

## `requireAuth`

```ts
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = (req.headers['x-srvfiles-token'] as string | undefined)
    ?? (req.query.token as string | undefined);
  if (validateToken(token)) {
    next();
  } else {
    const ip = (req.socket.remoteAddress ?? '').replace('::ffff:', '');
    log.warn('auth.middleware.ts', 'Unauthorized request — invalid or missing token', { ip, path: req.path });
    res.status(401).json({ error: 'Unauthorized' });
  }
}
```

### Fuentes del token

El token se acepta por dos vías:

1. **Header `X-SrvFiles-Token`**: modo preferido para peticiones HTTP normales (fetch, axios). El frontend web y la app Flutter lo ponen en todas las peticiones autenticadas.

2. **Query param `?token=...`**: necesario para los endpoints de descarga y preview, ya que los elementos `<img>`, `<video>`, `<audio>` e `<iframe>` del navegador no permiten enviar headers personalizados. El frontend los usa en las URLs de preview y descarga directa.

### Operador `??`

Usa el operador nullish coalescing: si `req.headers['x-srvfiles-token']` es `undefined`, intenta con `req.query.token`. A diferencia de `||`, `??` no considera `''` (string vacío) como falsy, lo que es más correcto para tokens.

### Comportamiento

- Si el token es válido: llama `next()` y el router protegido continúa normalmente.
- Si es inválido o ausente: responde `401` y registra la IP y la ruta en los logs.

### ¿Dónde se monta?

En `app.ts`:
```ts
app.use('/api/files', requireAuth, filesRouter);
app.use('/api/config', requireAuth, configRouter);
app.use('/api/discovery', requireAuth, discoveryRouter);
```
