# error-handler.ts

**Archivo:** `src/shared/middleware/error-handler.ts`
**Rol:** Middleware global de Express para el manejo centralizado de errores. Intercepta todos los errores propagados con `next(err)` en cualquier ruta, y devuelve respuestas HTTP estructuradas.

---

## `errorHandler`

```ts
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  log.error('error-handler', 'Unhandled error', { error: String(err) });
  res.status(500).json({ error: 'Internal server error' });
}
```

### ¿Cómo lo reconoce Express como error handler?

Express identifica un error handler por la firma de 4 parámetros `(err, req, res, next)`. Debe registrarse **después** de todos los routers en `app.ts`:
```ts
app.use(errorHandler);
```

### Lógica de despacho

1. **`err instanceof AppError`**: si el error pertenece a la jerarquía de errores de dominio (`FileNotFoundError`, `UnauthorizedError`, etc.), usa el `statusCode` y `code` del error para construir la respuesta. El mensaje del error va al cliente.

2. **Errores no esperados**: se loguean con `log.error` (incluyen el stack trace en dev) y el cliente recibe solo `{ error: 'Internal server error' }` — sin detalles internos que podrían revelar información sensible.

### Respuesta para errores de dominio

```json
{
  "error": "File \"foto.jpg\" not found",
  "code": "FILE_NOT_FOUND"
}
```

El campo `code` permite al frontend diferenciar entre errores y mostrar mensajes específicos.
