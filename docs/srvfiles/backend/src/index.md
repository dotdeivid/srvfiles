# index.ts

**Archivo:** `src/index.ts`
**Rol:** Punto de entrada del servidor. Crea la app Express, levanta los servidores HTTP y HTTPS con sus WebSocketServers asociados, e imprime las URLs y el PIN al arrancar.

---

## Creación de la app Express

```ts
const app = createApp();
```

La app Express se crea con `createApp()` (definida en `app.ts`) en lugar de configurarla aquí directamente. Esto separa la configuración de rutas del levantamiento de servidores, lo que permite importar `createApp` en tests sin arrancar puertos reales.

---

## Servidor HTTP (puerto 3001)

```ts
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', handleConnection);

server.listen(PORT, HOST, () => {
  log.debug('index.ts', 'HTTP server listening', { port: PORT });
});
```

El servidor HTTP escucha en `PORT` (por defecto `3001`) en todas las interfaces (`HOST = '0.0.0.0'`). Lo usan la webview de Tauri y la app Flutter, que no necesitan TLS porque conectan localmente o por canal de confianza.

El `WebSocketServer` se adjunta al mismo servidor HTTP para que las conexiones WebSocket (`/ws`) compartan el puerto 3001 sin abrir uno adicional.

---

## Servidor HTTPS (puerto 3002)

```ts
void (async () => {
  const cert = await getOrCreateCert(CERTS_DIR);
  const httpsServer = https.createServer({ key: cert.key, cert: cert.cert }, app);

  const wssHttps = new WebSocketServer({ server: httpsServer, path: '/ws' });
  wssHttps.on('connection', handleConnection);

  httpsServer.listen(HTTPS_PORT, HOST, () => {
    const lanIp = getLanIp();
    const pin = generatePin();
    console.log(`   Local (Tauri):  http://localhost:${PORT}`);
    console.log(`   Network (web):  https://${lanIp}:${HTTPS_PORT}`);
    console.log(`   PIN: ${pin}`);
  });
})();
```

El servidor HTTPS escucha en `HTTPS_PORT` (por defecto `PORT + 1 = 3002`). Es necesario para navegadores externos en la red local, ya que los navegadores modernos solo exponen `crypto.subtle` (requerido para el cifrado E2E del P2P) en contextos seguros (`localhost` o HTTPS).

Ambos servidores comparten exactamente el mismo objeto `app` y el mismo `handleConnection` — la diferencia es solo el transporte (HTTP vs HTTPS).

### Certificado TLS

`getOrCreateCert(CERTS_DIR)` genera un certificado autofirmado RSA-2048/SHA-256 la primera vez y lo persiste en `backend/certs/`. En arranques posteriores lo reutiliza. Los navegadores muestran advertencia la primera vez; el usuario debe aceptarla manualmente.

### Generación del PIN

`generatePin()` se llama dentro del callback de `httpsServer.listen` — es decir, una sola vez al arrancar, después de que el servidor HTTPS ya está escuchando. El PIN se imprime con el formato especial `PIN: XXXXXX` para que el IPC de Tauri pueda parsearlo.

---

## Manejo de errores y shutdown limpio

```ts
server.on('error', (err) => { log.error('index.ts', 'Error al iniciar el servidor HTTP', { error: String(err) }); });

process.on('SIGTERM', () => { resetAuth(); process.exit(0); });
process.on('SIGINT',  () => { resetAuth(); process.exit(0); });
process.on('uncaughtException', (err) => { log.error('index.ts', 'Excepción no capturada', { error: String(err) }); });
```

En SIGTERM y SIGINT (Ctrl+C o señal de proceso) se llama `resetAuth()` para borrar de memoria el PIN, los tokens de sesión y los contadores de rate limit antes de salir. Las excepciones no capturadas se loguean para debugging.

---

## ¿Por qué `void (async () => { ... })()`?

TypeScript prohíbe usar `await` en el top level de un módulo CommonJS. Se usa una IIFE async (`(async () => { ... })()`) para poder esperar `getOrCreateCert`. El prefijo `void` descarta la promesa devuelta sin dejarla flotando (silencia la advertencia de `@typescript-eslint/no-floating-promises`).
