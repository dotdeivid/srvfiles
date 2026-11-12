# updater.ts

**Archivo:** `frontend/src/lib/updater.ts`
**Rol:** Actualizador automático de la app de escritorio.

---

`checkForUpdates()`: solo en la app de escritorio. Consulta `latest.json` de GitHub Releases (`tauri-plugin-updater`); si hay versión nueva muestra un aviso con "Instalar y reiniciar" → `downloadAndInstall()` + `relaunch()`. El paquete se verifica con la clave pública de `tauri.conf.json`. Los errores se registran sin molestar al usuario. Configuración en `docs/setup.md`.
