# config.controller.ts

**Archivo:** `src/features/config/config.controller.ts`
**Rol:** Controlador del endpoint `GET /api/config`. Recopila los valores de configuración del servidor y los envía al frontend.

---

## `getConfig`

```ts
export function getConfig(_req: Request, res: Response): void {
  const lanIp = getLanIp();
  const config: AppConfig = {
    appName: APP_NAME,
    lanIp,
    port: PORT,
    httpsPort: HTTPS_PORT,
    frontendPort: FRONTEND_PORT,
    maxFileSizeMb: MAX_FILE_SIZE_MB,
    previewMaxFileSizeMb: PREVIEW_MAX_FILE_SIZE_MB,
    lanUrl: `http://${lanIp}`,
  };
  res.json(config);
}
```

### ¿Por qué se llama `getLanIp()` en cada request?

La IP LAN puede cambiar durante la ejecución del servidor (cambio de red WiFi, reconexión). Al llamarla en cada request, se devuelve siempre la IP actual.

### Campos del objeto respuesta

| Campo | Valor | Uso en el frontend |
|-------|-------|-------------------|
| `appName` | Configurable vía `APP_NAME` | Header, health check |
| `lanIp` | IP privada actual | QR, chip del header |
| `port` | `3001` (backend HTTP) | Construir `backendLanUrl` |
| `httpsPort` | `3002` (backend HTTPS) | Conexiones seguras desde navegador |
| `frontendPort` | `5173` (Vite dev) | URL del QR en desarrollo |
| `maxFileSizeMb` | `10240` por defecto | Hint en el DropZone |
| `previewMaxFileSizeMb` | `1024` por defecto | Límite para el botón "ver" |
| `lanUrl` | `http://{lanIp}` | URL base sin puerto |

### El tipo `: AppConfig`

Anotar la constante con el tipo garantiza que TypeScript avise si se agrega o elimina un campo de `AppConfig` sin actualizar este objeto.
