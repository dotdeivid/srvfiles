# SrvFiles — Checklist de pruebas funcionales

> Probá cada escenario y marcá el check cuando funcione correctamente.
>
> **Plataformas cubiertas:**
> - 🖥️ **Tauri** — app de escritorio (macOS/Windows/Linux), backend Node sidecar + frontend embebido
> - 🌐 **Browser** — cualquier navegador en la LAN accediendo por IP:puerto
> - 📱 **Mobile** — app Flutter Android (Mobile A = servidor, Mobile B = cliente)

---

## 🖥️ A. App Tauri (desktop)

### A1. Inicio
- [✅] La app Tauri abre sin errores y muestra la pantalla principal directamente (sin splash)
- [✅] El sidecar del backend Node se levanta automáticamente al abrir la app
- [✅] El header muestra la IP LAN y el puerto del **backend** (ej: `192.168.1.x:3001`), no el del frontend
- [✅] La autenticación es automática (auto-fetch del PIN por localhost, sin modal)
- [✅] El PIN actual se muestra en el chip del header junto al ícono de candado

### A2. Subida de archivos
- [✅] Arrastrar un archivo sobre el DropZone lo sube correctamente
- [✅] Usar el botón de selección de archivo (click en DropZone) sube correctamente
- [✅] La barra de progreso de subida se muestra durante la transferencia
- [✅] El archivo aparece en la lista al terminar (sin recargar manualmente)
- [✅] Subir múltiples archivos en secuencia funciona correctamente

### A3. Descarga de archivos
- [✅] Hacer click en un archivo lo descarga a la carpeta de Descargas del sistema operativo
- [✅] El archivo descargado es idéntico al original (sin corrupción)

### A4. Eliminación de archivos
- [✅] El botón eliminar muestra el modal de confirmación
- [✅] Confirmar elimina el archivo de la lista y del disco
- [✅] Cancelar no hace nada

### A5. Espacio en disco
- [✅] El header muestra `X libre / Y total` con valores reales del disco
- [✅] La barra de progreso refleja el espacio usado
- [⁇] Los colores cambian: normal → warning (>80% usado) → critical (>95% usado) => Queda pendiente, ya que debería subir bastante archivos

### A6. ServerSwitcherModal (chip de IP)
- [✅] Hacer click en el chip de IP abre el ServerSwitcherModal
- [✅] El modal muestra la URL del backend actual
- [✅] El modal muestra servidores descubiertos en la red (mobile en server mode, etc.)
- [⁇] Conectarse a un servidor de la lista cambia el contexto correctamente => Pendiente de validar luego de arreglar el punto anterior
- [✅] El campo de escaneo y re-escaneo funciona => Queda pendiente de validar, teniendo solucionado los items anterior

### A7. Nombre del dispositivo
- [✅] El nombre del dispositivo aparece en el header
- [✅] Hacer click abre el modal de renombre
- [✅] Cambiar el nombre se propaga a los otros clientes conectados al mismo servidor

### A8. QR footer
- [✅] El QR footer muestra el código QR con la URL LAN del servidor Tauri
- [✅] Escanear el QR desde el mobile o un browser abre la dirección correcta

### A9. Clientes online y P2P (con otros dispositivos)
- [✅] Al conectarse otro dispositivo (mobile o browser), aparece en la lista de clientes online
- [✅] Enviar un archivo a otro cliente muestra el request de transferencia en el receptor
- [✅] Recibir un archivo de otro cliente funciona y se guarda correctamente
- [✅] Aceptar / rechazar / cancelar transferencias funciona en ambas direcciones

---

## 🌐 B. Browser (acceso LAN)

### B1. Acceso y autenticación
- [✅] Ingresar `http://IP:3001` (desktop como servidor) carga la UI correctamente
- [✅] Si el servidor tiene PIN, aparece el modal de PIN antes de ver archivos
- [✅] Ingresar PIN incorrecto muestra error en el mismo modal
- [✅] Ingresar PIN correcto carga la pantalla con archivos
- [✅] El token persiste durante la sesión (no pide PIN al recargar la página)
- [✅] Ingresar `http://IP_MOBILE:PORT` (mobile en server mode) carga la UI correctamente
- [✅] La autenticación contra el mobile servidor funciona igual

### B2. Subida de archivos
- [✅] Arrastrar un archivo al DropZone lo sube correctamente (desktop servidor)
- [✅] Arrastrar un archivo al DropZone lo sube correctamente (mobile servidor)
- [✅] Usar el botón de selección sube correctamente en ambos casos
- [✅] La barra de progreso se muestra durante la subida
- [✅] El archivo aparece en la lista al terminar

### B3. Descarga de archivos
- [✅] Hacer click en un archivo lo descarga al equipo
- [✅] El archivo descargado no está corrompido

### B4. Eliminación de archivos
- [✅] El botón eliminar muestra confirmación
- [✅] Confirmar elimina el archivo
- [✅] Cancelar no hace nada

### B5. Espacio en disco
- [✅] El header muestra `X libre / Y total` con valores reales
- [✅] Funciona tanto cuando el servidor es el desktop como cuando es el mobile

### B6. ServerSwitcherModal
- [✅] El chip de IP en el header muestra la dirección del servidor al que está conectado
- [✅] El chip muestra el PIN cuando está disponible (servidor local)
- [⁇] Abrir el modal muestra otros servidores descubiertos => Pendiente de validar cuando pruebe con otras PCs
- [✅] Cambiar de servidor actualiza la lista de archivos

### B7. Nombre del dispositivo
- [✅] El nombre del dispositivo aparece en el header
- [✅] Hacer click abre el modal de renombre
- [✅] El nombre persiste al recargar la página (localStorage)

### B8. P2P desde browser
- [✅] Al conectarse otro dispositivo al mismo servidor, aparece en la lista de clientes online
- [✅] Enviar un archivo desde el browser a un mobile funciona
- [✅] Recibir un archivo desde un mobile en el browser funciona
- [✅] La transferencia funciona en HTTP (LAN, sin HTTPS) — sin error `randomUUID is not a function` 
- [✅] El progreso de transferencia se muestra en el browser

### B9. Estado sin archivos
- [✅] El estado vacío se muestra correctamente cuando no hay archivos en el servidor

---

## 📱 C. App Mobile — como cliente

### C1. Splash y conexión
- [✅] Al abrir la app, el splash busca servidores en la red automáticamente
- [✅] Los servidores encontrados (desktop Tauri y/o mobile servidor) aparecen en la lista 
- [✅] Tocar un servidor de la lista navega a la pantalla principal conectado a él
- [✅] Si no hay servidores, muestra el mensaje correspondiente

### C2. Autenticación PIN (cliente)
- [✅] Al conectarse a un servidor protegido, aparece el modal de PIN
- [✅] El fondo NO muestra "Reintentar" mientras el modal de PIN está abierto
- [✅] PIN incorrecto muestra error en el modal
- [✅] PIN correcto carga la pantalla con archivos
- [✅] Presionar "Cancelar" en el modal de PIN navega de vuelta al splash
- [⁇] Re-autenticación al expirar el token funciona => pendiente de probar

### C3. Subida de archivos
- [✅] El FAB / botón de subida abre el selector de archivos del sistema
- [✅] Seleccionar un archivo lo sube al servidor conectado
- [✅] La barra de progreso se muestra durante la subida
- [✅] El archivo aparece en la lista al terminar

### C4. Descarga de archivos
- [✅] Tocar un archivo lo descarga y guarda en `Descargas/SrvFiles` => Se sube correctamente, pero no se encuentra el archivo en la carpeta Download/SrvFiles, tampoco se crea la carpeta SrvFiles. Por lo menos en android no se ve
- [✅] El archivo descargado se puede abrir desde la app (open_filex) => Todos dan error al intentar descargar
- [✅] El archivo no está corrompido => pendiente de validar, cuando los items anteriores se corrijan

### C5. Eliminación de archivos
- [✅] El botón eliminar muestra confirmación => No tiene boton de eliminar. Quitar el boton de compartir para los archivos listados en la tabla de archivos subidos y agregar el de eliminar. Para los archivos recibidos directamente, dejar el boton compartir y agregar el boton de eliminar tambien
- [✅] Confirmar elimina el archivo del servidor => pendiente de validar, cuando los items anteriores se corrijan
- [✅] Cancelar no hace nada => pendiente de validar, cuando los items anteriores se corrijan

### C6. ConnectSheet (cliente conectado)
- [✅] El icono wifi del header abre el ConnectSheet
- [✅] El sheet muestra la card del servidor conectado (IP:puerto, badge "Conectado")
- [✅] La sección de escaneo está disponible para cambiar de servidor
- [✅] El botón "Desconectarse" navega al splash

### C7. Nombre del dispositivo
- [✅] La primera vez se asigna un nombre aleatorio automáticamente (sin modal)
- [✅] Tocar el nombre en el header abre el modal de renombre
- [✅] Cambiar el nombre se refleja en los otros clientes conectados
- [✅] El nombre persiste entre reinicios de la app => Cuando se cambia de app, deja de funcionar. Cuando se bloquea el celular, se mantiene

### C8. P2P como cliente
- [✅] Los otros clientes conectados al servidor aparecen en la lista
- [✅] Tocar un cliente y seleccionar archivo envía la solicitud de transferencia
- [✅] El modal de transferencia entrante aparece con nombre de archivo y remitente
- [✅] Aceptar → el archivo se recibe y guarda correctamente
- [✅] Rechazar → el enviador ve la notificación de rechazo
- [✅] Cancelar una transferencia en progreso funciona

### C9. Espacio en disco
- [✅] La barra de disco en el header muestra `X libre / Y total` del servidor conectado

---

## 📱 D. App Mobile — como servidor (server mode)

### D1. Activación del servidor
- [✅] Desde el splash, "Ser el servidor" activa el server mode directamente
- [✅] La primera vez muestra el diálogo de advertencia antes de activar
- [✅] Marcar "No mostrar de nuevo" en la advertencia la omite en el futuro => Vuelve a mostrar cuando me desconecto y eligo de vuelta "Ser el servidor"
- [✅] Al activar, la pantalla principal muestra la UI de gestión de archivos (no pantalla en blanco)
- [✅] El servicio en primer plano (foreground service) se activa para mantener el relay vivo

### D2. ConnectSheet (servidor activo)
- [✅] El icono wifi_tethering del header abre el ConnectSheet
- [✅] El sheet muestra "Tu servidor" como título
- [✅] La card muestra la IP:puerto del relay, badge "Activo" y el PIN
- [✅] No aparece la sección de "Conectar a servidor"

### D3. Subida desde la misma app (server mode)
- [✅] El FAB sube archivos al servidor local propio
- [✅] El archivo aparece en la lista

### D4. Espacio en disco (servidor)
- [✅] La barra muestra `X libre / Y total` con valores reales del dispositivo (no 0/0)
- [✅] Los valores corresponden al almacenamiento interno

### D5. QR y URL
- [✅] El QR footer muestra la URL del relay mobile
- [✅] Escanear el QR desde otro dispositivo abre la UI web del mobile servidor

### D6. Acceso desde browser al servidor mobile
- [✅] Ingresar la IP:puerto del mobile en un browser carga la UI correctamente
- [✅] La autenticación con el PIN funciona desde el browser
- [✅] Subir, descargar y eliminar archivos desde el browser funciona
- [✅] Los archivos subidos desde el browser aparecen en la app mobile

### D7. Estabilidad del servidor
- [✅] Con la pantalla bloqueada, el relay sigue funcionando (foreground service activo)
- [✅] Clientes conectados no se desconectan al bloquear la pantalla

---

## 📱 G. Envío Directo (sin servidor)

> Escenario base: dos celulares (A y B) con la app instalada, en la misma red Wi-Fi, **sin ningún servidor corriendo** (ni Tauri ni mobile server mode).

### G1. Inicio del modo directo

- [ ] Tocar "Envío directo" en el splash muestra la pantalla principal sin archivos de servidor (solo la sección "Dispositivos en la red" y archivos recibidos)
- [ ] El relay embebido se levanta automáticamente en segundo plano (sin modal de advertencia)
- [ ] La sección "Dispositivos en la red" aparece con un spinner de búsqueda al inicio
- [ ] El foreground service se activa para mantener el relay vivo en background

### G2. Descubrimiento de dispositivos

- [ ] Dispositivo A descubre a Dispositivo B en la lista "Dispositivos en la red" (y viceversa)
- [ ] El nombre mostrado para cada dispositivo es el nombre configurado (no "SrvFiles" genérico)
- [ ] La IP del dispositivo se muestra correctamente debajo del nombre
- [ ] Si un dispositivo se apaga o cierra la app, desaparece de la lista en el próximo ciclo de escaneo (~5s)
- [ ] El botón de refresh manual re-escanea la red instantáneamente

### G3. Envío de archivo A → B

- [ ] Tocar "Enviar" en la fila de B abre el selector de archivos del sistema
- [ ] Seleccionar un archivo muestra el estado "Esperando respuesta..." en la fila de B
- [ ] En el dispositivo B aparece el diálogo de solicitud entrante con nombre del archivo y remitente
- [ ] Aceptar en B activa la barra de progreso en A y en B
- [ ] El archivo se recibe correctamente en B y se guarda en `Download/SrvFiles/received`
- [ ] Al completar, aparece la notificación en B con el nombre del archivo
- [ ] El snackbar "Archivo recibido" en B desaparece después de ~5 segundos

### G4. Rechazo y cancelación

- [ ] Rechazar la solicitud en B muestra "El destinatario rechazó el envío" en A
- [ ] Cancelar desde A (durante el envío) detiene la transferencia en ambos lados
- [ ] Cancelar desde B (durante la recepción) notifica a A y limpia el estado

### G5. Pool de conexiones

- [ ] Enviar un segundo archivo al mismo dispositivo sin esperar 1 minuto reutiliza la conexión existente (sin delay visible de reconexión)
- [ ] Si no se envía nada durante 60 segundos, la conexión al relay del par se cierra sola (verificable en logs)
- [ ] Después del timeout, el siguiente envío reconecta correctamente

### G6. Envío bidireccional simultáneo

- [ ] A puede enviar a B mientras B envía a A al mismo tiempo (transferencias independientes)
- [ ] El progreso de cada transferencia se muestra correctamente en ambos dispositivos

### G7. Compatibilidad con otros modos

- [ ] Un mobile en modo directo puede descubrir y ver en la lista un mobile en server mode
- [ ] Un mobile en modo directo puede enviar un archivo directamente a un dispositivo conectado al servidor Tauri (que aparece en el scan)
- [ ] Al tocar "Envío directo" desde el splash y luego volver (back), el relay se apaga correctamente
- [ ] Cambiar de modo directo a cliente (conectar a un servidor) cierra el scanning y el pool

---

## 🔄 E. Flujos end-to-end entre plataformas

### E1. Desktop Tauri como hub
- [ ] **Tauri sube** → browser lo descarga
- [ ] **Browser sube** → Tauri lo ve → mobile lo descarga
- [ ] **Mobile sube** → Tauri lo ve → browser lo descarga

### E2. Mobile como hub (server mode)
- [ ] **Browser sube al mobile** → otra app mobile lo descarga
- [ ] **App mobile (cliente) sube** → browser lo descarga desde el mobile
- [ ] **Mobile servidor sube** (FAB) → browser y mobile cliente lo ven

### E3. P2P entre todas las combinaciones
- [ ] **Tauri → Mobile**: el archivo se recibe en el mobile
- [ ] **Mobile → Tauri**: el archivo se recibe en Tauri (browser embebido)
- [ ] **Browser → Mobile**: la transferencia funciona en HTTP/LAN
- [ ] **Mobile → Browser**: la transferencia funciona en HTTP/LAN
- [ ] **Mobile A → Mobile B**: la transferencia funciona entre dos apps mobile

### E4. Cambio de servidor en caliente
- [ ] Mobile conectado al Tauri → cambiar al mobile servidor → archivos del nuevo servidor se cargan
- [ ] Browser conectado al Tauri → cambiar al mobile servidor → funciona correctamente

---

## ⚠️ F. Casos borde y resiliencia

### F1. Archivos
- [ ] Subir un archivo cuyo nombre ya existe genera `archivo (1).ext` (sin sobreescribir)
- [ ] Subir un archivo de >100 MB no rompe la app ni el servidor mobile
- [ ] El nombre de archivo con caracteres especiales (`ñ`, espacios, `&`) se maneja correctamente
- [ ] El estado vacío se muestra correctamente cuando no hay archivos

### F2. Conexión y red
- [ ] Ingresar una IP inválida en el campo manual del ConnectSheet muestra error claro
- [ ] Si el servidor se cae mientras se está conectado, la app mobile reconecta automáticamente (~3s)
- [ ] Si el servidor se cae mientras el PIN dialog está abierto, no se cuelga
- [ ] Cancelar el PIN dialog y volver a conectarse al mismo servidor funciona sin estado corrupto

### F3. Autenticación
- [ ] Abrir dos pestañas del browser contra el mismo servidor funciona (tokens independientes)
- [ ] El token NO persiste al cerrar el browser (sessionStorage, no localStorage)

### F4. Mobile server mode
- [ ] Detener y volver a activar el server mode genera un PIN nuevo
- [ ] El PIN nuevo se refleja en el ConnectSheet correctamente
- [ ] Clientes previos con el token viejo son desautenticados (reciben modal de PIN)



