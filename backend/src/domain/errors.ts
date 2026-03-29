/**
 * Base application error with HTTP status code and machine-readable code.
 * All domain-specific errors extend this class so the global error handler
 * can map them automatically to the correct HTTP response.
 */
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

export class FileNotFoundError extends AppError {
  constructor(filename: string) {
    super(`File "${filename}" not found`, 404, 'FILE_NOT_FOUND');
  }
}

export class InvalidFilenameError extends AppError {
  constructor(filename: string) {
    super(`Invalid filename: "${filename}"`, 400, 'INVALID_FILENAME');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Demasiados intentos. Intentá de nuevo en 60 segundos.') {
    super(message, 429, 'RATE_LIMITED');
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 400, 'BAD_REQUEST');
  }
}
