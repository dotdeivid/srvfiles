# errors.ts

**Archivo:** `src/domain/errors.ts`
**Rol:** Define la jerarquía de errores de dominio. Cada error lleva un código HTTP y un código de máquina para que el error handler global pueda responder automáticamente sin lógica adicional en los controladores.

---

## `AppError` (clase base)

```ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'INTERNAL_ERROR',
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

Clase base de la que heredan todos los errores de dominio. Añade dos campos sobre `Error`:

- **`statusCode`**: código HTTP que el error handler usará en la respuesta (por defecto `500`).
- **`code`**: identificador legible por máquinas (por defecto `'INTERNAL_ERROR'`). El frontend puede usarlo para mostrar mensajes específicos o tomar decisiones.

`this.name = this.constructor.name` hace que el nombre del error sea el nombre de la subclase (`FileNotFoundError`, `UnauthorizedError`, etc.) en lugar del genérico `Error`.

---

## Errores específicos

### `FileNotFoundError`

```ts
export class FileNotFoundError extends AppError {
  constructor(filename: string) {
    super(`File "${filename}" not found`, 404, 'FILE_NOT_FOUND');
  }
}
```

Se lanza cuando se solicita un archivo que no existe en el directorio de uploads. Produce respuesta `404`.

### `InvalidFilenameError`

```ts
export class InvalidFilenameError extends AppError {
  constructor(filename: string) {
    super(`Invalid filename: "${filename}"`, 400, 'INVALID_FILENAME');
  }
}
```

Se lanza cuando un nombre de archivo contiene caracteres prohibidos (path traversal, etc.). Produce respuesta `400`.

### `UnauthorizedError`

```ts
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}
```

Se lanza cuando una petición no tiene token válido. Produce respuesta `401`.

### `RateLimitError`

```ts
export class RateLimitError extends AppError {
  constructor(message = 'Demasiados intentos. Intentá de nuevo en 60 segundos.') {
    super(message, 429, 'RATE_LIMITED');
  }
}
```

Se lanza cuando una IP supera el límite de intentos fallidos de PIN. Produce respuesta `429`.

### `BadRequestError`

```ts
export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 400, 'BAD_REQUEST');
  }
}
```

Error genérico para peticiones malformadas que no encajan en un error más específico. Produce respuesta `400`.

---

## Cómo los usa el error handler

El `errorHandler` global (en `shared/middleware/error-handler.ts`) hace `instanceof AppError`. Si lo es, usa `err.statusCode` y `err.code` directamente. Si no lo es, responde con `500` genérico. Esto elimina `try/catch` repetitivos en los controladores para errores esperados.
