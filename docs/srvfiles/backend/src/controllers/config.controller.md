# controllers/config.controller.ts

**Archivo:** `src/controllers/config.controller.ts`
**Rol:** Controlador del endpoint de configuración. Recopila los valores de configuración del servidor y los envía al frontend.

---

## Función `getConfig`

```ts
export function getConfig(_req: Request, res: Response): void {
  const lanIp = getLanIp();
  const config: AppConfig = {
    appName: APP_NAME,
    lanIp,
    port: PORT,
    frontendPort: FRONTEND_PORT,
    maxFileSizeMb: MAX_FILE_SIZE_MB,
    lanUrl: `http://${lanIp}`,
  };
  res.json(config);
}
```

### ¿Por qué se llama a `getLanIp()` en cada request y no al iniciar el servidor?

La IP LAN puede cambiar durante la ejecución del servidor (el usuario se desconecta del WiFi y se reconecta, cambia de red, etc.). Al llamarla en cada request, siempre se devuelve la IP actual.

### El tipo `: AppConfig`

```ts
const config: AppConfig = { ... };
```

Anotar la constante con el tipo garantiza que si se agrega o elimina un campo de `AppConfig`, TypeScript marcará un error aquí hasta que el objeto esté actualizado. Sin la anotación, TypeScript inferiría el tipo del objeto literal, pero no avisaría si falta un campo requerido en `AppConfig`.

### Campos del objeto respuesta

| Campo | Valor | Uso en el frontend |
|---|---|---|
| `appName` | Nombre configurable | Header, health check |
| `lanIp` | IP privada actual | QR, chip del header, backendLanUrl |
| `port` | 3001 (backend) | Construir `backendLanUrl` |
| `frontendPort` | 5173 (Vite dev) | Construir URL del QR en dev |
| `maxFileSizeMb` | 2048 por defecto | Hint en el DropZone |
| `lanUrl` | `http://{lanIp}` | URL base sin puerto |
