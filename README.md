# SrvFiles — Servidor de Archivos Local

Aplicación web para compartir archivos fácilmente entre dispositivos en tu red local. Subí archivos desde una PC y descargalos desde otra.

## 🚀 Inicio Rápido

### Requisitos
- **Node.js** v18 o superior
- **npm** v9 o superior

### Instalación

```bash
# Clonar e instalar todas las dependencias
npm run install:all
```

O instalar manualmente:

```bash
# Dependencias del backend
cd backend && npm install

# Dependencias del frontend
cd ../frontend && npm install
```

### Ejecutar

```bash
# Ejecutar backend y frontend simultáneamente
npm run dev
```

O ejecutar por separado:

```bash
# Terminal 1 — Backend (puerto 3001)
cd backend && npm run dev

# Terminal 2 — Frontend (puerto 5173)
cd frontend && npm run dev
```

## 📂 ¿Dónde se guardan los archivos?

Los archivos cargados se almacenan en:
```
backend/uploads/
```
Esta carpeta se crea automáticamente al iniciar el backend.

## 🌐 Acceder desde Otro Dispositivo

1. **Encontrá tu IP local:**
   ```bash
   # macOS
   ipconfig getifaddr en0

   # Linux
   ip a | grep inet | grep -v 127.0.0.1

   # Windows
   ipconfig
   ```

2. **Abrí en el otro dispositivo:**
   ```
   http://TU_IP:5173
   ```
   
3. **O escaneá el QR** que aparece en el footer de la app. El QR siempre apunta a la IP privada del servidor.

> **Nota:** El frontend detecta automáticamente la IP del servidor, por lo que las llamadas al backend funcionan tanto desde `localhost` como desde la IP de red.

## ⚙️ Variables de Entorno

### Backend

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3001` | Puerto del servidor Express |
| `APP_NAME` | `SrvFiles` | Nombre de la app (se muestra en header y logs) |
| `MAX_FILE_SIZE_MB` | `2048` (2GB) | Tamaño máximo de archivo en MB |
| `FRONTEND_PORT` | `5173` | Puerto del frontend (para generar URL del QR) |

Ejemplo:
```bash
APP_NAME="MiServer" MAX_FILE_SIZE_MB=500 npm run dev
```

### Frontend (`frontend/.env`)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `VITE_BACKEND_PORT` | `3001` | Puerto del backend (auto-detección) |
| `VITE_API_URL` | *(auto)* | Sobreescribe la URL del backend (no recomendado) |
| `VITE_APP_NAME` | *(del backend)* | Fallback del nombre si el backend no responde |

## 📁 Estructura del Proyecto

```
srvfiles/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Servidor Express (0.0.0.0:3001)
│   │   ├── routes/
│   │   │   └── files.route.ts    # Endpoints de archivos
│   │   └── middleware/
│   │       └── upload.ts         # Configuración de Multer
│   └── uploads/                  # ← Archivos subidos (aquí)
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── files.api.ts      # Cliente axios (auto-detección IP)
│   │   ├── components/
│   │   │   ├── DropZone.tsx      # Drag & drop
│   │   │   ├── FileList.tsx      # Lista/grilla de archivos
│   │   │   ├── FileItem.tsx      # Archivo individual
│   │   │   ├── DiskStats.tsx     # Espacio en disco
│   │   │   ├── QRFooter.tsx      # QR code (IP privada)
│   │   │   └── ConfirmModal.tsx  # Modal de confirmación
│   │   ├── hooks/
│   │   │   ├── useFiles.ts       # Lógica de archivos + auto-polling
│   │   │   └── useConfirm.ts     # Hook para confirm modal
│   │   ├── App.tsx
│   │   └── index.css             # Design system
│   └── .env                      # Config del frontend
└── package.json                  # Scripts de monorepo
```

## 📡 API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/files/upload` | Sube uno o múltiples archivos |
| `GET` | `/api/files` | Lista todos los archivos |
| `GET` | `/api/files/download/:filename` | Descarga un archivo |
| `DELETE` | `/api/files/:filename` | Elimina un archivo |
| `GET` | `/api/files/stats` | Espacio en disco (total/usado/libre) |
| `GET` | `/api/config` | Configuración (IP, nombre, límites) |
| `GET` | `/api/health` | Health check |

## 🛡️ Seguridad

- Sanitización de nombres de archivo (prevención de path traversal)
- Límite de tamaño configurable (por defecto 2GB)
- CORS permisivo (`*`) — diseñado para red local
- Sin autenticación — uso exclusivo en red privada

## 🛠️ Stack

- **Backend:** Node.js + Express + Multer + TypeScript
- **Frontend:** React + Vite + TypeScript
- **Estilos:** Vanilla CSS con tema oscuro y glassmorphism
- **Sin base de datos** — los archivos se guardan directamente en disco
