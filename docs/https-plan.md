# Plan: HTTPS con certificado autofirmado

## Objetivo

Proteger el tráfico cuando el servidor Tauri se usa en una red local pública
(WiFi de café, hotel, etc.) donde alguien podría estar haciendo sniffing de paquetes.

## Mapa de canales de comunicación

Todos los canales posibles entre dispositivos, y su estado de protección:

| Canal | Transporte | Cifrado hoy | HTTPS necesario |
|-------|-----------|-------------|-----------------|
| Tauri webview ↔ backend Tauri | HTTP localhost | ✅ E2E WebSocket (crypto.subtle disponible en localhost) | ❌ No — loopback, nunca sale a la red |
| App Flutter ↔ backend Tauri | HTTP LAN | ✅ E2E AES-256-GCM (package:cryptography, no depende de TLS) | ❌ No — ya cifrado a nivel aplicación |
| App Flutter ↔ relay embebido Flutter | HTTP localhost del celu | ✅ E2E AES-256-GCM | ❌ No — loopback interno |
| Tauri (cliente) ↔ Tauri (servidor) | HTTP LAN | ✅ E2E WebSocket (webview en localhost = contexto seguro) | ❌ No — ya cifrado |
| Flutter ↔ Flutter (relay en Flutter) | HTTP LAN | ✅ E2E AES-256-GCM | ❌ No — ya cifrado |
| **Navegador web ↔ backend Tauri** | **HTTP LAN** | **❌ Sin cifrado** | **✅ Sí — único canal expuesto** |

### Conclusión

El certificado autofirmado y el servidor HTTPS **solo beneficia al navegador web** (Chrome/Safari/Firefox del celu o PC) que accede al servidor Tauri por IP local. Todos los demás canales ya están protegidos por E2E a nivel de aplicación y no requieren TLS.

Además, una vez el navegador accede por HTTPS, `crypto.subtle` queda disponible y la encriptación E2E del WebSocket también se activa para ese canal, cerrando el último hueco.

---

## Estado actual de seguridad (resumen)

| Escenario | Protegido hoy | Por qué |
|-----------|--------------|---------|
| App Flutter ↔ Tauri (P2P) | ✅ Sí | E2E AES-256-GCM, independiente de HTTPS |
| Tauri ↔ Tauri | ✅ Sí | E2E WebSocket (webview = contexto seguro) |
| Flutter ↔ Flutter | ✅ Sí | E2E AES-256-GCM |
| Tauri webview ↔ su propio backend | ✅ Sí | Localhost, nunca sale a la red |
| **Navegador web ↔ Tauri (HTTP LAN)** | **❌ No** | `crypto.subtle` bloqueado en HTTP, tráfico en texto plano |

El único hueco es el navegador externo accediendo por HTTP sobre la LAN.

---

## Arquitectura propuesta: servidor dual

El problema central es que **Tauri y el navegador externo son clientes distintos**:

- **Tauri webview** carga desde `http://localhost:PORT` — no necesita HTTPS (es loopback)
- **Navegador externo** accede por `http://192.168.x.x:PORT` — necesita HTTPS

Solución: mismo Express app, **dos listeners**:

```
http://127.0.0.1:PORT    → solo loopback → Tauri sigue exactamente igual, sin cambios
https://0.0.0.0:PORT+1   → LAN → navegadores externos, con TLS
```

Por ejemplo con `PORT=3000`: Tauri usa `http://localhost:3000`, el celu usa `https://192.168.1.x:3001`.

No hay un "segundo servidor" como proceso separado — es el mismo Express montado en dos `http/https.createServer()`.

---

## Componentes afectados

### Backend — trabajo principal

**Archivos:** `src/index.ts`, `src/config.ts`, `src/lib/cert.ts` (nuevo)

Cambios:
1. Nuevo módulo `cert.ts`: genera cert autofirmado con `selfsigned` si no existe, lo persiste en `CERTS_DIR`
2. `index.ts`: agrega `https.createServer({ key, cert }, app)` escuchando en `PORT+1` sobre `0.0.0.0`
3. El `WebSocketServer` se adjunta también al server HTTPS (mismo handler `handleConnection`)
4. `config.ts`: agrega `HTTPS_PORT = PORT + 1` y `CERTS_DIR`

### Tauri — trivial

**Archivos:** `src-tauri/src/lib.rs`

Solo agregar `CERTS_DIR` como variable de entorno al spawn del sidecar (igual que `UPLOADS_DIR`).
La webview Tauri **no cambia** — sigue cargando `http://localhost:PORT`.

### Frontend — cambios de UI

**Archivos:** componentes de configuración/conexión, QR

Cambios:
1. Mostrar la URL HTTPS (`https://IP:PORT+1`) en el panel de red y el QR
2. Agregar aviso: *"Primera vez: el navegador pedirá aceptar el certificado → Avanzado → Continuar"*
3. El frontend ya detecta si `crypto.subtle` está disponible — en HTTPS estará disponible, por lo que la encriptación E2E del WebSocket también se activará desde el navegador

### Mobile (Flutter) — sin cambios obligatorios

La app Flutter **no necesita cambios** porque:
- Ya tiene E2E cifrado a nivel de aplicación (no depende de TLS)
- El `http` package de Dart acepta HTTP

Opcional a futuro: conectar al puerto HTTPS para doble capa de seguridad (requiere configurar el cliente HTTP para aceptar el cert autofirmado).

---

## Experiencia del usuario (navegador externo)

**Primera vez:**
1. Escanear QR → abre `https://192.168.x.x:3001`
2. El browser muestra *"Tu conexión no es privada"* (cert autofirmado)
3. Clic en *Avanzado* → *Continuar con 192.168.x.x (no seguro)*
4. Listo — el browser recuerda la excepción

**Próximas veces:** entra directo, sin advertencia.

---

## Fases de implementación

| Fase | Qué hace | Complejidad | Archivos |
|------|----------|-------------|---------|
| 1 | Generar/persistir cert autofirmado | Baja | `backend/src/lib/cert.ts` (nuevo) |
| 2 | Servidor dual HTTP + HTTPS | Media | `backend/src/index.ts`, `src/config.ts` |
| 3 | Pasar `CERTS_DIR` al sidecar | Trivial | `src-tauri/src/lib.rs` |
| 4 | UI: mostrar URL HTTPS + aviso | Baja | componentes frontend |

**Estimación total: 1 día de trabajo.**

---

## Dependencias a agregar

```bash
# Backend
npm install selfsigned
npm install --save-dev @types/selfsigned
```

---

## Lo que NO cambia

- El PIN de autenticación sigue igual
- La encriptación E2E del WebSocket P2P sigue igual
- La app Flutter sigue igual
- El comportamiento en `http://localhost` para Tauri sigue igual
- Los tests existentes siguen funcionando (apuntan a HTTP localhost)
