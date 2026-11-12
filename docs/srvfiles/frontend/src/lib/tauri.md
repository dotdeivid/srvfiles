# tauri.ts

**Archivo:** `frontend/src/lib/tauri.ts`
**Rol:** Puente con la app de escritorio.

---

`isTauriApp()`, `getBackendPort()`, `onBackendRestarted(cb)`, `onNativeProgress(evento, id, cb)`, `pathInfo`, `nativeUpload`, `nativeDownload`, `cancelNativeTransfer`, `beginReceive`, `appendReceive` (cuerpo binario crudo), `finishReceive`, `abortReceive`. Los comandos están en `src-tauri/src/files.rs`; el webview no tiene permisos de sistema de archivos.
