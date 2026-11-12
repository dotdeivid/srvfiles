# auth/service.go

**Archivo:** `backend/internal/auth/service.go`
**Rol:** Estado de autenticación en memoria: PIN, sesiones, tokens de enlace y límite de intentos.

---

## PIN

- `GeneratePin()` genera 6 dígitos (100000–999999) con `crypto/rand` y lo guarda **solo en memoria** (no hay hash: con un millón de combinaciones no aportaba nada).
- `GetPin()` lo usa `/api/pin` (solo loopback).
- `ValidatePin()` compara en tiempo constante (`subtle.ConstantTimeCompare`).

## Sesiones

- `CreateSession()` → token UUID v4 válido por `sessionTTL` (12 h) **sin uso**: cada `ValidateToken()` exitoso renueva el vencimiento.
- `NewID()` (UUID v4) lo usan también los clientes WebSocket.

## Tokens de enlace

Para URLs que el navegador abre sin cabeceras (`<a>`, `<img>`, `<video>`):

- `CreateLinkToken(filename)` → token válido `LinkTokenTTL` (10 min) **solo para ese archivo**; reutilizable en ese plazo (el video pide rangos sucesivos). Limpia los vencidos al crear.
- `ValidateLinkToken(token, filename)`.

## Límite de intentos

| Nivel | Regla |
|---|---|
| Por IP | 5 fallos → bloqueada 60 s. El contador se olvida recién cuando pasó la ventana (antes se borraba en cada comprobación y el bloqueo nunca se activaba). |
| Global | 20 fallos en 60 s entre todas las IPs → login pausado 60 s. |

`CheckRateLimit(ip)`, `RecordFailedAttempt(ip)`, `ClearFailedAttempts(ip)`.

`ResetAuth()` borra todo (al apagar y en tests). `now` es una variable para controlar el reloj en tests.
