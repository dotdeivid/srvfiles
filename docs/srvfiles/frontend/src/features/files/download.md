# download.ts

**Archivo:** `frontend/src/features/files/download.ts`
**Rol:** Descargar uno o varios archivos del servidor actual.

---

- `downloadFile(name, deps)`: en la app de escritorio `downloadWithTauri` (streaming a `Descargas/SrvFiles` con progreso y cancelar en el aviso, token en la cabecera); en el navegador pide un token de enlace (`getLinkedUrl(name, 'download')`) y dispara un `<a download>`, así el token de sesión nunca va en la URL.
- `downloadFiles(names, deps)`: uno tras otro. En el navegador deja 400 ms entre clics, porque varios `<a download>` seguidos hacen que el navegador descarte algunos (y pregunta una vez si se permiten descargas múltiples).
