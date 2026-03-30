# SrvFiles — Inventario de funcionalidades

> Última actualización: 2026-03-29

---

## Web (navegador)

### Conexión y autenticación
- Detección automática del servidor al abrir la app (escanea la red local con 6 reintentos × 500 ms)
- Auto-autenticación desde `localhost` (obtiene el PIN sin mostrar diálogo)
- Diálogo de PIN para servidores remotos (6 dígitos)
- Token de sesión persistido en `sessionStorage`; se re-pide si el servidor lo invalida
- Manejo de `401`: reabre el diálogo automáticamente

### Gestión de archivos
- Listar archivos del servidor (ordenados por fecha, más nuevo primero)
- Subir archivos con drag & drop y zona visual de drop
- Subida múltiple en un solo request
- Barra de progreso real durante la subida (porcentaje exacto)
- Descarga de archivos con atributo `download` nativo del navegador
- Eliminar archivos con diálogo de confirmación
- Búsqueda en tiempo real por nombre (case-insensitive, filtro frontend)
- Indicador de espacio en disco (total / usado / libre con barra visual)

### Vista previa
- Botón "ver" (icono ojo) en lista y grilla — solo aparece en tipos soportados
- Validación de tamaño antes de previsualizar (límite `PREVIEW_MAX_FILE_SIZE_MB`, default 1 GB)
- Modal full-screen con cierre por ESC o clic fuera del contenido
- Tipos soportados:

| Categoría | Extensiones |
|-----------|------------|
| Imagen | jpg, jpeg, png, gif, webp, bmp, ico |
| SVG | svg |
| Video | mp4, mov, m4v, webm |
| Audio | mp3, wav, aac, m4a, ogg, flac, opus |
| PDF | pdf |
| Texto / Código | txt, md, json, xml, csv, yaml, yml, html, js, ts, dart, py, go, rs, c, cpp, h, css, sh, bash |
| Desconocido | descarga nativa del navegador |

- PDF e iframes sirven desde `/api/files/preview/` (inline, sin `Content-Disposition: attachment`)
- Imágenes con zoom (rueda del mouse / trackpad)

### Vistas y UI
- Modo lista (tabla) y modo grilla (cards) con toggle persistido en sesión
- Header con nombre de app, chip del servidor (muestra IP/PIN si es local), chip del dispositivo, stats de disco
- Toast notifications para acciones (éxito, error, advertencia) — librería Sonner
- Spinner de carga durante la conexión inicial al servidor
- Banner de error si el servidor no responde

### Transferencia P2P directa
- Panel de dispositivos conectados (se expande cuando hay otros online)
- Íconos según tipo: 📱 (mobile), 🖥 (Tauri/servidor), 🌐 (navegador)
- Envío de archivos directamente a otro dispositivo sin pasar por disco del servidor
- Diálogo de solicitud entrante (aceptar / rechazar) con nombre y tamaño del archivo
- Barra de progreso durante envío y recepción
- Cancelación en cualquier momento
- Mensaje `send-complete` con notificación de finalización

### Cifrado E2E
- Intercambio de claves ECDH P-256 al inicio de sesión WebSocket
- Clave derivada con HKDF-SHA-256 — cada sesión tiene clave única
- Cifrado de chunks con AES-256-GCM + IV aleatorio por mensaje
- Solo activo en contextos seguros (`localhost` o HTTPS) — `crypto.subtle` requerido

### Descubrimiento de red
- Modal "Cambiar servidor" con lista de servidores SrvFiles detectados en la red
- Botón de rescan manual con indicador de carga
- Ingreso manual de URL
- QR code de acceso con URL completa del servidor
- QR code apunta a la URL HTTPS del servidor (puerto 3002) para que los navegadores accedan con contexto seguro

### Dispositivo
- Nombre del dispositivo editable (modal al primer uso)
- Persistido en `localStorage`
- Propagado a otros clientes en tiempo real vía WebSocket (`rename`)

---

## Tauri (desktop — macOS, Windows, Linux)

> Tauri comparte todo el código React del frontend web. Las diferencias son exclusivamente en integración con el SO.

Todas las funcionalidades de Web, más:

### Descarga de archivos
- Descarga a `~/Downloads/SrvFiles/` automáticamente (sin diálogo del navegador)
- Creación del directorio `SrvFiles` si no existe
- Toast con ruta de destino al completar
- Mismo comportamiento para archivos recibidos por P2P

### Backend embebido
- Backend Node.js corre como sidecar (proceso autónomo) junto a la app
- Frontend servido directamente desde el backend en producción
- Accesible desde el navegador de la red local (sin instalar nada extra)
- Auto-arranque al abrir la app; auto-detención al cerrar

### Logging
- Logs persistidos en archivo usando `tauri-plugin-log`
- Niveles: debug, info, warn, error
- Accesibles desde el directorio de datos de la app

### "Abrir con" en preview
- Archivos de tipo desconocido se abren con la aplicación nativa del sistema (`shell.open()`)

---

## Mobile (Flutter — Android)

### Modos de operación
- **Cliente**: se conecta a un servidor SrvFiles externo (desktop o mobile)
- **Servidor**: levanta servidor HTTP + WebSocket propio; otros dispositivos se conectan vía navegador o app
- **Relay P2P**: actúa como punto de encuentro para transferencias entre dispositivos sin exponer archivos propios
- **Envío directo**: escanea la red y envía archivos directamente a otros dispositivos

### Conexión y autenticación
- Descubrimiento automático de servidores en la red local al abrir la app
- Diálogo de PIN para conectarse a servidores protegidos (6 dígitos)
- Auto-login si el servidor local es el propio relay embebido
- Token persistido en `SharedPreferences` para reutilizar sesión entre arranques
- Manejo de `401`: reabre el diálogo PIN automáticamente
- Cabecera `X-SrvFiles-Token` en todos los requests HTTP

### Gestión de archivos del servidor
- Listar archivos del servidor (lista y grilla)
- Subir archivos desde el selector nativo del sistema
- Descargar archivos a `Download/SrvFiles/`
- Eliminar archivos con diálogo de confirmación
- Compartir archivos (integración con share sheet del SO)
- Copiar enlace directo de descarga al portapapeles
- Búsqueda por nombre en tiempo real
- Indicador de espacio en disco (total / usado / libre)

### Vista previa
- Botón "ver" (icono ojo) en lista y grilla — solo aparece en tipos soportados
- Validación de tamaño antes de previsualizar (límite leído desde `AppConfig.previewMaxFileSizeMb`)
- Pantalla completa con AppBar transparente y FAB "← Volver"
- Archivos del servidor: descarga a directorio temporal → previsualiza → borra al cerrar
- Archivos recibidos: abre directamente desde disco (sin descarga extra)
- Tipos soportados:

| Categoría | Extensiones | Librería |
|-----------|------------|---------|
| Imagen | jpg, jpeg, png, gif, webp, bmp, ico | `photo_view` (zoom/pan con gestos) |
| SVG | svg | `flutter_svg` |
| Video | mp4, mov, m4v, webm | `video_player` + `chewie` |
| Audio | mp3, wav, aac, m4a, ogg, flac, opus | `audioplayers` + UI con play/pausa y slider |
| PDF | pdf | `pdfx` (scroll de páginas) |
| Texto / Código | txt, md, json, xml, csv, yaml, yml, html, js, ts, dart, py, go, rs, c, cpp, h, css, sh, bash | widget monospace scrollable |
| Desconocido | docx, xlsx, zip, apk, etc. | botón "Abrir con" → `open_filex` |

### Transferencia P2P directa
- Listado en tiempo real de dispositivos conectados al relay
- Envío de archivos directamente a otro dispositivo (sin pasar por disco del servidor)
- Diálogo de solicitud entrante (aceptar / rechazar) con nombre del remitente y tamaño
- Barra de progreso durante envío y recepción
- Cancelación en cualquier momento
- Archivos recibidos guardados en `Download/SrvFiles/received/`
- Notificación local al completar una transferencia

### Cifrado E2E
- Intercambio de claves ECDH P-256 al conectar al relay
- Derivación de clave compartida con HKDF
- Cifrado de transferencias con AES-256-GCM

### Servidor embebido (modo servidor / relay)
- Servidor HTTP + WebSocket en puerto 3001 (fallback a 3002–3010)
- Escucha en todas las interfaces (`0.0.0.0`) — accesible desde la red local
- Frontend web embebido en el APK — cualquier navegador de la red puede conectarse
- PIN generado automáticamente al activar el modo servidor (6 dígitos, hash SHA-256)
- Endpoint `/api/pin` accesible solo desde loopback
- Rate limiting: 5 intentos de PIN fallidos → bloqueo de 60 segundos por IP
- Sesiones de token en memoria (duran mientras la app esté activa)
- CRUD completo de archivos, estadísticas de disco y configuración expuestos vía API REST
- ConnectSheet: panel con IP, PIN, puerto y estado del servidor, accesible desde el header

### Descubrimiento de red
- Escaneo automático de la subred `/24` al arrancar
- Probing paralelo de 254 hosts con timeout de 3 segundos
- Identificación por `{ status: "ok", app: "SrvFiles" }` en `/api/health`
- Actualización periódica de la lista de servidores disponibles

### Ciclo de vida y background
- Servicio en primer plano (Android): mantiene el WebSocket activo con la pantalla bloqueada
- Notificación persistente visible mientras el servicio está corriendo (requerido en Android 8+)
- Reconexión automática al WebSocket al volver al primer plano
- Cleanup ordenado de servicios al cerrar la app
- Solicitud de permiso de notificaciones al primer arranque (Android 13+)

### Archivos recibidos
- Lista dedicada de archivos recibidos por P2P
- Apertura directa con `open_filex`
- Compartir con share sheet del SO
- Vista previa en la misma pantalla que los archivos del servidor
- Eliminación individual con confirmación

### UI / UX
- Splash screen de carga antes de la pantalla principal
- Tema oscuro con paleta `AppColors` unificada
- Vistas lista y grilla con toggle
- Glassmorphism cards en la grilla (`GlassCard`)
- Long-press en cualquier archivo → bottom sheet contextual (descargar, compartir, copiar enlace, eliminar)
- QR code del servidor para conectar desde otro dispositivo sin tipear la IP
- Nombre del dispositivo editable y persistido en `SharedPreferences`

### Logging
- `AppLogger` con niveles debug, info, warn, error
- Salida en consola en modo debug
- Escritura en archivo en modo release
- Identificación de módulo en cada entrada

---

## Transversal (todas las plataformas)

### Seguridad
- Path traversal prevenido con sanitización de filenames en el backend
- PIN con hash SHA-256 (nunca se almacena en plano en producción)
- Rate limiting: 5 intentos fallidos → bloqueo 60 s por IP
- Tokens de sesión UUID sin estado en el servidor (limpios al reiniciar)
- Cifrado E2E en transferencias P2P (ECDH P-256 + HKDF + AES-256-GCM)

### API REST del backend
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/health` | Identificación del servidor (pública) |
| `POST` | `/api/auth` | Validar PIN → obtener token de sesión |
| `GET` | `/api/pin` | Obtener PIN (solo desde localhost) |
| `GET` | `/api/config` | Configuración del servidor (IP, puertos, límites) |
| `GET` | `/api/files` | Listar archivos |
| `POST` | `/api/files/upload` | Subir archivos (multipart) |
| `GET` | `/api/files/download/:name` | Descargar archivo (attachment) |
| `GET` | `/api/files/preview/:name` | Servir archivo inline (para preview) |
| `GET` | `/api/files/stats` | Estadísticas de disco |
| `DELETE` | `/api/files/:name` | Eliminar archivo |
| `GET` | `/api/discovery/scan` | Escanear la red en busca de otros servidores |
| `WS` | `/ws` | Canal WebSocket P2P |

### Protocolo WebSocket P2P
| Mensaje | Dirección | Descripción |
|---------|-----------|-------------|
| `hello` | cliente → servidor | Registro inicial con nombre y tipo de dispositivo |
| `welcome` | servidor → cliente | Confirmación con clientId asignado |
| `clients` | servidor → todos | Lista actualizada de dispositivos conectados |
| `set-receiving` | cliente → servidor | Indicar disponibilidad para recibir |
| `rename` | cliente → servidor | Cambiar nombre visible |
| `key-exchange` | bidireccional | Intercambio de clave pública ECDH |
| `send-request` | cliente → servidor → cliente | Solicitud de transferencia |
| `send-accept` | cliente → servidor → cliente | Aceptación |
| `send-reject` | cliente → servidor → cliente | Rechazo |
| `send-cancel` | cliente → servidor → cliente | Cancelación |
| `send-complete` | cliente → servidor → cliente | Fin de transferencia |
| binario | cliente → servidor → cliente | Chunk de archivo (36 bytes transferId + datos) |

### Variables de entorno configurables
| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3001` | Puerto del servidor HTTP |
| `APP_NAME` | `SrvFiles` | Nombre mostrado en la UI |
| `MAX_FILE_SIZE_MB` | `10240` | Límite de subida por archivo (MB) |
| `MAX_UPLOAD_COUNT` | `50` | Máximo de archivos por request |
| `PREVIEW_MAX_FILE_SIZE_MB` | `1024` | Límite para previsualización (MB) |
| `HTTPS_PORT` | `PORT+1` | Puerto del servidor HTTPS para navegadores externos |
| `CERTS_DIR` | `<cwd>/certs` | Directorio del certificado TLS auto-generado |
