# auth.service.ts

**Archivo:** `src/features/auth/auth.service.ts`
**Rol:** Gestiona el ciclo de vida del PIN y las sesiones en memoria. Expone funciones puras para generar, validar y limpiar el estado de autenticación, incluyendo rate limiting por IP.

---

## Estado en módulo (in-memory)

```ts
let pinHash: string | null = null;
let pinPlain: string | null = null;
const sessions = new Map<string, true>();
const rateLimitMap = new Map<string, { count: number; blockedUntil: number }>();
```

Todo el estado de auth vive en estas cuatro variables del módulo. Se reinicia con cada arranque del proceso y se puede limpiar explícitamente con `resetAuth()`.

- `pinHash`: SHA-256 del PIN actual. Nunca se compara texto plano contra texto plano.
- `pinPlain`: el PIN en texto plano. Solo lo lee el endpoint `/api/pin` (exclusivo de localhost).
- `sessions`: `Map` de tokens UUID activos. El valor es simplemente `true` — la existencia de la clave es lo que importa.
- `rateLimitMap`: contador de intentos fallidos por IP y timestamp de bloqueo.

---

## Generación del PIN

```ts
export function generatePin(): string {
  const pin = String(crypto.randomInt(100_000, 1_000_000));
  pinHash = crypto.createHash('sha256').update(pin).digest('hex');
  pinPlain = pin;
  return pin;
}
```

Genera un PIN de 6 dígitos usando `crypto.randomInt` (criptográficamente seguro). Almacena el hash SHA-256 para comparaciones posteriores y el texto plano para el endpoint localhost. Devuelve el texto plano para que `index.ts` lo imprima al arrancar.

`crypto.randomInt(100_000, 1_000_000)` genera un número en `[100000, 1000000)` — siempre 6 dígitos, con el `0` inicial preservado gracias al `String()`.

---

## `getPin`

```ts
export function getPin(): string | null {
  return pinPlain;
}
```

Acceso de solo lectura al PIN en texto plano. Usado exclusivamente por el endpoint `/api/pin` de `app.ts` para que Tauri pueda leerlo sin que el usuario lo escriba.

---

## `validatePin`

```ts
export function validatePin(input: string): boolean {
  if (!pinHash) return false;
  const h = crypto.createHash('sha256').update(input).digest('hex');
  return h === pinHash;
}
```

Compara hasheando el input en lugar de comparar texto plano contra texto plano. Si `pinHash` es `null` (el servidor aún no generó PIN), devuelve `false`.

---

## Gestión de sesiones

```ts
export function createSession(): string {
  const token = crypto.randomUUID();
  sessions.set(token, true);
  return token;
}

export function validateToken(token: string | undefined): boolean {
  return !!token && sessions.has(token);
}
```

`createSession` genera un UUID v4 criptográficamente seguro y lo registra. `validateToken` verifica que el token exista en el `Map`; acepta `undefined` para no tener que verificar antes de llamarlo.

---

## Rate limiting

```ts
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 60_000;

export function checkRateLimit(ip: string): { blocked: boolean } { ... }
export function recordFailedAttempt(ip: string): void { ... }
export function clearFailedAttempts(ip: string): void { ... }
```

Después de 5 intentos fallidos desde la misma IP, se bloquea esa IP durante 60 segundos. El bloqueo expira automáticamente: `checkRateLimit` limpia la entrada del `Map` cuando `blockedUntil` ya pasó.

`clearFailedAttempts` se llama en autenticación exitosa para no penalizar al usuario si escribe mal el PIN unas veces antes de acertar.

---

## `resetAuth`

```ts
export function resetAuth(): void {
  pinHash = null;
  pinPlain = null;
  sessions.clear();
  rateLimitMap.clear();
}
```

Limpia todo el estado de autenticación. Se llama en `index.ts` al recibir SIGTERM o SIGINT para que el PIN y los tokens no queden en memoria si el proceso se reutiliza.
