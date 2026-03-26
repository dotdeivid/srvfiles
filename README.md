# SrvFiles

Compartí archivos entre dispositivos en la misma red local. Sin internet, sin cuenta, sin configuración.

## ¿Cómo funciona?

Levantás SrvFiles en una computadora — vía web o como app de escritorio (Tauri) — y todos los dispositivos de la red pueden conectarse desde el navegador o desde la app mobile para subir, descargar y transferir archivos entre sí.

## Características

- **Subida y descarga** — drag & drop, múltiples archivos, hasta 10 GB por archivo
- **Transferencia P2P directa** — enviá archivos de dispositivo a dispositivo sin pasar por disco, vía relay WebSocket
- **Detección automática de servidores** — la UI encuentra otros servidores SrvFiles en la red; podés cambiar desde el header
- **App de escritorio nativa** — empaquetada con Tauri 2 para macOS, Windows y Linux; actúa simultáneamente como servidor y cliente
- **Autenticación PIN** — cada servidor genera un PIN automático de 6 dígitos; auto-auth desde localhost
- **QR de acceso** — para conectar el celular sin tipear la IP
- **Espacio en disco** — indicador visual en tiempo real

## Ecosistema

| Componente | Descripción |
|------------|-------------|
| **Backend** | Node.js · Express · WebSocket |
| **Frontend** | React · Vite — accesible desde cualquier navegador |
| **Desktop** | Tauri 2 — empaqueta backend + frontend como app nativa |
| **Mobile** | Flutter Android — cliente, servidor o relay P2P puro |

---

## Comandos

### Requisitos

| Herramienta | Versión |
|-------------|---------|
| Node.js | 18+ |
| npm | 9+ |
| Rust + cargo | stable (solo Tauri) |

```bash
# Instalar todas las dependencias
npm run install:all
```

### Modo web (desarrollo)

```bash
npm run dev
```

Backend en `http://localhost:3001`, frontend en `http://localhost:5173` con hot reload.
Otros dispositivos acceden por `http://<tu-ip>:5173`.

### Modo desktop / Tauri (desarrollo)

```bash
# Primera vez o tras cambios en el backend — compilar el sidecar
npm run build:sidecar

# Levantar Tauri con hot reload
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

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3001` | Puerto del servidor |
| `APP_NAME` | `SrvFiles` | Nombre mostrado en la UI |
| `MAX_FILE_SIZE_MB` | `10240` | Límite por archivo (MB) |
| `UPLOADS_DIR` | `<cwd>/uploads` | Carpeta de almacenamiento |
| `VITE_BACKEND_PORT` | `3001` | Puerto del backend (frontend) |

---

## Notas importantes

- El frontend sirve como SPA desde el backend en producción (`frontend/dist/`). En desarrollo, Vite corre separado en el puerto 5173.
- En Tauri, el backend corre como sidecar (binario autónomo). Cambios en el backend requieren re-ejecutar `npm run build:sidecar`.
- Los archivos recibidos vía P2P se guardan en `~/Downloads/SrvFiles/`.
- La app mobile tiene su propio repo. Ver [srvfiles-mobile](https://github.com/dotdeivid/srvfiles-mobile).
