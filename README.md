# SrvFiles

Compartí archivos entre dispositivos en la misma red local. Sin internet, sin cuenta, sin configuración.

## ¿Cómo funciona?

Levantás SrvFiles en una computadora — vía web o como app de escritorio (Tauri) — y todos los dispositivos de la red pueden conectarse desde el navegador o desde la app mobile para subir, descargar y transferir archivos entre sí.

## Características

- **Subida y descarga** — drag & drop, múltiples archivos, hasta 10 GB por archivo
- **Previsualización** — abrí imágenes, video, audio, PDF y texto directamente en la UI sin descargar (ver tabla abajo); límite configurable via `PREVIEW_MAX_FILE_SIZE_MB`
- **Transferencia P2P directa** — enviá archivos de dispositivo a dispositivo sin pasar por disco, vía relay WebSocket
- **Cifrado E2E en P2P** — intercambio de claves ECDH P-256 + AES-256-GCM; cada sesión usa una clave efímera
- **Detección automática de servidores** — la UI encuentra otros servidores SrvFiles en la red; podés cambiar desde el header
- **App de escritorio nativa** — empaquetada con Tauri 2 para macOS, Windows y Linux; actúa simultáneamente como servidor y cliente
- **Autenticación PIN** — cada servidor genera un PIN automático de 6 dígitos; auto-auth desde localhost
- **QR de acceso** — para conectar el celular sin tipear la IP
- **Espacio en disco** — indicador visual en tiempo real
- **Logging estructurado** — niveles debug/info/warn/error; backend con winston, Tauri con tauri-plugin-log

## Ecosistema

| Componente | Descripción |
|------------|-------------|
| **Backend** | Go · chi · gorilla/websocket — binario único ~8 MB, arranque <10 ms |
| **Frontend** | React · Vite — accesible desde cualquier navegador |
| **Desktop** | Tauri 2 — empaqueta backend + frontend como app nativa |
| **Mobile** | Flutter Android — cliente, servidor o relay P2P puro |

---

## Comandos

### Requisitos

| Herramienta | Versión |
|-------------|---------|
| Go | 1.22+ |
| Node.js | 18+ |
| npm | 9+ |
| Rust + cargo | stable (solo Tauri) |

```bash
# Instalar dependencias de Node
npm run install:all

# Descargar dependencias de Go
cd backend && go mod download && cd ..
```

### Modo web (desarrollo)

```bash
npm run dev
```

Backend Go en `http://localhost:3001`, frontend en `http://localhost:5173` con hot reload.
Otros dispositivos acceden por `https://<tu-ip>:3002` (la primera vez hay que aceptar el certificado autofirmado en el navegador).

### Modo desktop / Tauri (desarrollo)

```bash
# Primera vez o tras cambios en el backend — compilar el sidecar Go
npm run build:sidecar

# Levantar Tauri con hot reload en el frontend
npm run tauri:dev
```

### Build de producción

```bash
# Genera instaladores nativos (.dmg / .exe / .deb)
npm run tauri:build
```

Los artefactos quedan en `src-tauri/target/release/bundle/`.

### Release automática (CI/CD)

```bash
git tag v1.2.0 && git push origin v1.2.0
```

Dispara GitHub Actions y publica los instaladores en la sección Releases del repo.

---

## Archivos que se pueden previsualizar

| Categoría | Extensiones | Web / Tauri |
|-----------|------------|-------------|
| **Imagen** | jpg, jpeg, png, gif, webp, bmp, ico | `<img>` + zoom con scroll |
| **SVG** | svg | `<img>` nativo |
| **Video** | mp4, mov, m4v, webm | Vidstack player (controles modernos) |
| **Audio** | mp3, wav, aac, m4a, ogg, flac, opus | `<audio>` con controles nativos |
| **PDF** | pdf | `<iframe>` inline |
| **Texto / Código** | txt, md, json, xml, csv, yaml, yml, html, js, ts, dart, py, go, rs, c, cpp, h, css, sh, bash | `<pre>` scrollable monospace |
| **Desconocido** | docx, xlsx, zip, apk, etc. | Descarga nativa (browser) · `shell.open()` (Tauri) |

Archivos que superen el límite `PREVIEW_MAX_FILE_SIZE_MB` (default 1 GB) no se pueden previsualizar y muestran un aviso.

---

## Variables de entorno

El archivo de referencia completo está en `backend/internal/config/config.go`.

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3001` | Puerto del servidor |
| `APP_NAME` | `SrvFiles` | Nombre mostrado en la UI |
| `MAX_FILE_SIZE_MB` | `10240` | Límite de tamaño por archivo (MB) |
| `MAX_UPLOAD_COUNT` | `50` | Máximo de archivos por request de subida |
| `PREVIEW_MAX_FILE_SIZE_MB` | `1024` | Límite para previsualización (MB) |
| `UPLOADS_DIR` | `<cwd>/uploads` | Carpeta de almacenamiento |
| `HTTPS_PORT` | `PORT+1` | Puerto HTTPS para navegadores externos |
| `FRONTEND_PORT` | `5173` | Puerto de Vite en desarrollo (usado en config CORS) |
| `CERTS_DIR` | `<cwd>/certs` | Carpeta del certificado TLS (auto-generado) |
| `VITE_BACKEND_PORT` | `3001` | Puerto del backend (frontend) |

---

## Notas importantes

- El frontend sirve como SPA desde el backend en producción (`frontend/dist/`). En desarrollo, Vite corre separado en el puerto 5173.
- En Tauri, el backend corre como sidecar (binario autónomo). Cambios en el backend requieren re-ejecutar `npm run build:sidecar`.
- Los archivos recibidos vía P2P se guardan en `~/Downloads/SrvFiles/`.
- La app mobile tiene su propio repo. Ver [srvfiles-mobile](https://github.com/dotdeivid/srvfiles-mobile).
