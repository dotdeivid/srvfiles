# SrvFiles

Aplicación de escritorio y web para compartir archivos entre dispositivos en la misma red local. No requiere internet, no requiere cuenta, no requiere configuración.

## ¿Qué hace?

Levantás SrvFiles en una computadora y todos los dispositivos de la red pueden conectarse para subir, descargar y transferir archivos directamente entre sí.

**Capacidades:**

- **Subida de archivos** — drag & drop, clic para explorar, múltiples archivos simultáneos, hasta 2 GB por archivo
- **Descarga directa** — link directo desde la lista; los archivos recibidos vía P2P se guardan automáticamente en `~/Downloads/SrvFiles/`
- **Lista de archivos** — búsqueda en tiempo real, vista lista y grilla, ícono por tipo de archivo
- **Eliminación** — solo disponible desde la app de escritorio (quien corre el servidor)
- **Espacio en disco** — indicador visual de uso en tiempo real
- **QR de acceso** — código QR en el footer para conectar el celular sin tipear la IP
- **Transferencia P2P directa** — enviá archivos de dispositivo a dispositivo sin pasar por disco. Se usa relay WebSocket a través del servidor; no requiere conexión directa entre pares
- **Detección automática** — la app encuentra servidores SrvFiles en la red local al iniciar, sin configuración manual
- **Nombre de dispositivo** — cada cliente puede identificarse con un nombre visible para los demás al momento de enviar archivos
- **App de escritorio nativa** — empaquetada con Tauri 2: instaladores nativos para macOS, Windows y Linux

---

## Desarrollo

### Requisitos

| Herramienta | Versión mínima |
|-------------|----------------|
| Node.js | 18 |
| npm | 9 |
| Rust + cargo | stable (solo para Tauri) |

```bash
# Instalar todas las dependencias (raíz + backend + frontend)
npm run install:all
```

---

### Modo web (sin Tauri)

El modo más rápido para desarrollar. El backend corre en el puerto 3001 y el frontend (Vite) en el 5173 con hot reload.

```bash
# Iniciar backend y frontend en paralelo
npm run dev
```

O en terminales separadas si necesitás ver los logs por separado:

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Accedé desde el navegador en `http://localhost:5173`.
Otros dispositivos de la red pueden conectarse a `http://<tu-ip>:5173`.

> Si corrés solo el backend (`cd backend && npm run dev`), servirá el último build estático del frontend desde `frontend/dist/`. Útil para pruebas de producción sin Vite.

---

### Modo app de escritorio (Tauri)

La app de escritorio empaqueta el backend como sidecar (binario autónomo que se lanza junto con la ventana Tauri).

**Primera vez — compilar el sidecar:**

```bash
npm run build:sidecar
```

Esto compila el backend con `pkg` y copia el binario a `src-tauri/binaries/`. Solo es necesario repetirlo cuando cambia el código del backend.

**Desarrollo con hot reload:**

```bash
npm run tauri:dev
```

Abre la ventana de Tauri con Vite corriendo detrás. Los cambios en el frontend se reflejan en tiempo real. Los cambios en el backend requieren re-ejecutar `npm run build:sidecar` y reiniciar.

---

## Build

### Build temporal (preview)

Genera el frontend compilado y lo sirve desde el backend. Útil para probar la app completa antes de empaquetarla.

```bash
# 1. Compilar el frontend
cd frontend && npm run build

# 2. Iniciar el backend (sirve frontend/dist/ automáticamente)
cd ../backend && npm start
```

Accedé en `http://localhost:3001` (o la IP de red).

### Build final (instaladores nativos)

Genera instaladores nativos para distribución: `.dmg` en macOS, `.exe/.msi` en Windows, `.deb/.AppImage` en Linux.

```bash
npm run tauri:build
```

El proceso hace automáticamente:
1. `vite build` — compila el frontend
2. `build:sidecar` — compila el backend como binario autónomo
3. `cargo build --release` — compila la capa Tauri
4. Empaqueta todo en un instalador nativo

Los artefactos quedan en `src-tauri/target/release/bundle/`.

---

## CI / CD

El repositorio incluye un workflow de GitHub Actions (`.github/workflows/release.yml`) que genera instaladores automáticamente al publicar un tag.

### Cómo lanzar una release

```bash
git tag v1.2.0
git push origin v1.2.0
```

Esto dispara el workflow en GitHub y al terminar encontrás los instaladores en la sección **Releases** del repositorio.

### Qué hace el workflow

| Paso | Descripción |
|------|-------------|
| Checkout | Clona el repositorio |
| System deps (Ubuntu) | Instala librerías de sistema necesarias para WebKit/GTK |
| Node.js 20 | Configura el entorno JS con cache de `node_modules` |
| Rust stable | Instala toolchain con el target de la plataforma |
| Cache Rust | Cachea `~/.cargo` y `src-tauri/target` para builds más rápidos (~5-10 min ahorro) |
| Install deps | `npm ci && npm run install:all` |
| Build & Release | `tauri-apps/tauri-action@v0` — build completo + crea la GitHub Release |

### Plataformas configuradas

| Plataforma | Runner | Costo relativo |
|------------|--------|----------------|
| Linux (x86_64) | `ubuntu-22.04` | 1× |
| Windows | `windows-latest` | 2× |
| macOS (Apple Silicon) | *(comentado)* | 10× |

macOS está comentado para ahorrar minutos de CI. Para generar el `.dmg` de macOS, compilá localmente con `npm run tauri:build` desde una Mac.

### Variables requeridas

El workflow usa `GITHUB_TOKEN` (provisto automáticamente por GitHub Actions). No requiere secrets adicionales.

---

## Estructura del proyecto

```
srvfiles/
├── backend/                        # Servidor Express + WebSocket
│   └── src/
│       ├── index.ts                # Entry point: Express + WebSocketServer
│       ├── config/index.ts         # Variables de entorno y getLanIp()
│       ├── types/index.ts          # Interfaces TypeScript compartidas
│       ├── controllers/
│       │   └── files.controller.ts # Handlers HTTP
│       ├── routes/
│       │   └── files.route.ts      # Definición de rutas
│       ├── middleware/
│       │   └── upload.ts           # Multer + resolución de conflictos de nombre
│       ├── services/
│       │   ├── files.service.ts    # Operaciones de archivo (listar, borrar, stats)
│       │   ├── discovery.service.ts# Escaneo de red para otros servidores
│       │   └── transfer.service.ts # Relay WebSocket para transferencias P2P
│       └── utils/
│           └── sanitize.ts         # Sanitización de nombres de archivo
│
├── frontend/                       # React + Vite
│   └── src/
│       ├── App.tsx                 # Componente raíz, layout y modales
│       ├── api/
│       │   ├── files.api.ts        # Cliente HTTP (axios)
│       │   ├── discovery.api.ts    # Cliente de descubrimiento de red
│       │   └── transfer.api.ts     # Cliente WebSocket P2P
│       ├── components/
│       │   ├── DropZone.tsx        # Área de drag & drop con staging
│       │   ├── FileList.tsx        # Lista/grilla con búsqueda y toggle de vista
│       │   ├── FileItem.tsx        # Fila o card de archivo individual
│       │   ├── DiskStats.tsx       # Indicador de espacio en disco
│       │   ├── QRFooter.tsx        # QR de acceso LAN
│       │   ├── ConfirmModal.tsx    # Dialog de confirmación genérico
│       │   ├── NameModal.tsx       # Modal de nombre de dispositivo (primer arranque)
│       │   ├── IncomingTransferModal.tsx # Solicitud de transferencia entrante
│       │   └── OnlineClients.tsx   # Lista de peers conectados + botón de envío
│       ├── hooks/
│       │   ├── useFiles.ts         # Estado de archivos + polling automático
│       │   ├── useMode.ts          # Auto-conexión y descubrimiento de servidor
│       │   ├── useTransfer.ts      # Estado de transferencias P2P
│       │   ├── useDeviceName.ts    # Nombre del dispositivo (localStorage)
│       │   └── useDownloadDir.ts   # Integración con sistema de archivos Tauri
│       └── utils/
│           ├── fileIcons.ts        # Mapeo extensión → emoji
│           └── format.ts           # formatBytes() y formatDate()
│
├── src-tauri/                      # Capa nativa Tauri 2
│   ├── src/
│   │   ├── main.rs                 # Entry point Tauri
│   │   └── lib.rs                  # Setup: lanza el sidecar del backend
│   ├── capabilities/
│   │   └── default.json            # Permisos ACL de Tauri
│   └── tauri.conf.json             # Configuración de la app (nombre, íconos, ventana)
│
├── scripts/
│   └── build-sidecar.sh            # Compila el backend con pkg para Tauri
│
├── .github/
│   └── workflows/
│       └── release.yml             # CI/CD: build multiplataforma al pushear un tag
│
└── package.json                    # Scripts del monorepo
```

---

## Variables de entorno

### Backend

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3001` | Puerto del servidor Express y WebSocket |
| `HOST` | `0.0.0.0` | Interfaz de red (escucha en todas) |
| `APP_NAME` | `SrvFiles` | Nombre mostrado en la UI y logs |
| `FRONTEND_PORT` | `5173` | Puerto del frontend en dev (para el chip de URL) |
| `MAX_FILE_SIZE_MB` | `2048` | Límite de tamaño por archivo en MB |
| `UPLOADS_DIR` | `<cwd>/uploads` | Ruta de almacenamiento (Tauri lo setea al data dir) |

### Frontend (`frontend/.env`)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `VITE_BACKEND_PORT` | `3001` | Puerto del backend para auto-detección de URL |
| `VITE_API_URL` | *(auto)* | Override completo de la URL del backend |

---

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/health` | Health check — responde `{ status: "ok", app: "SrvFiles" }` |
| `GET` | `/api/config` | Configuración: IP, puertos, nombre, límites |
| `GET` | `/api/files` | Lista todos los archivos subidos |
| `POST` | `/api/files/upload` | Sube uno o múltiples archivos (multipart/form-data, campo `files`) |
| `GET` | `/api/files/download/:filename` | Descarga un archivo |
| `DELETE` | `/api/files/:filename` | Elimina un archivo |
| `GET` | `/api/files/stats` | Espacio en disco (total / usado / libre en bytes) |
| `GET` | `/api/discovery/scan` | Escanea la red local buscando otros servidores SrvFiles |
| `WS` | `/ws` | WebSocket para transferencias P2P (señalización JSON + relay binario) |

---

## Seguridad

- **Sanitización de nombres**: previene path traversal (se rechazan `..`, `/`, `\` y caracteres especiales)
- **Límite de tamaño**: configurable, por defecto 2 GB por archivo
- **Sin autenticación**: diseñado para uso en red privada de confianza
- **CORS permisivo**: necesario para acceso LAN desde distintos orígenes
- **Eliminación restringida**: el botón de borrar solo aparece en la app de escritorio Tauri (quien ejecuta el servidor)

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js · Express · TypeScript · ws · Multer |
| Frontend | React · Vite · TypeScript · react-dropzone · sonner · qrcode.react |
| Desktop | Tauri 2 (Rust) · tauri-plugin-fs · tauri-plugin-dialog |
| Estilos | Vanilla CSS — tema oscuro, glassmorphism |
| Empaquetado | @yao-pkg/pkg (sidecar backend) |
| CI/CD | GitHub Actions · tauri-apps/tauri-action |
