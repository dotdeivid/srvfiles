# app.ts

**Archivo:** `src/app.ts`
**Rol:** Factory que crea y configura la aplicación Express: registra middlewares globales, monta los routers de cada feature, sirve el frontend en producción, y adjunta el error handler global.

---

## `createApp`

```ts
export function createApp(): express.Express {
  const app = express();
  // ...
  return app;
}
```

Separar la creación de la app de `index.ts` (que arranca los servidores) permite importar `createApp` en tests sin abrir puertos reales.

---

## Middlewares globales

```ts
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
```

- **`cors({ origin: '*' })`**: permite peticiones desde cualquier origen. Necesario en modo dev donde el frontend (Vite, puerto 5173) y el backend (puerto 3001) tienen orígenes distintos.
- **`express.json()`**: parsea cuerpos `application/json` y los expone en `req.body`.
- **`express.urlencoded`**: parsea cuerpos de formularios HTML (`application/x-www-form-urlencoded`).

---

## Rutas públicas (sin autenticación)

```ts
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
```

`/api/health` y `/api/auth` son las únicas rutas que no requieren token. Cualquier dispositivo puede hacer un health check o intentar autenticarse.

---

## Endpoint /api/pin (solo localhost)

```ts
app.get('/api/pin', (req, res) => {
  const ip = (req.socket.remoteAddress ?? '').replace('::ffff:', '');
  const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '';
  if (!isLocal) { res.status(403).json({ error: 'Forbidden' }); return; }
  const pin = getPin();
  if (!pin) { res.status(503).json({ error: 'Server not ready' }); return; }
  res.json({ pin });
});
```

Devuelve el PIN en texto plano, pero solo a conexiones que vienen de `127.0.0.1` o `::1`. Lo usa exclusivamente la webview de Tauri para auto-autenticarse sin que el usuario tenga que escribir el PIN. Una conexión remota recibe `403 Forbidden`.

---

## Rutas protegidas (requireAuth)

```ts
app.use('/api/files', requireAuth, filesRouter);
app.use('/api/config', requireAuth, configRouter);
app.use('/api/discovery', requireAuth, discoveryRouter);
```

El middleware `requireAuth` se intercala entre la definición de la ruta y el router. Si el token es inválido o está ausente, `requireAuth` responde `401` y el router nunca se ejecuta.

---

## Servir el frontend (producción)

```ts
const FRONTEND_DIST = (process as any).pkg
  ? path.join(__dirname, '..', '..', 'frontend', 'dist')
  : path.resolve(process.cwd(), '..', 'frontend', 'dist');

app.use(express.static(FRONTEND_DIST));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'), (err) => {
      if (err) res.status(404).json({ error: 'Frontend not built. Run: cd frontend && npm run build' });
    });
  }
});
```

`express.static` sirve los archivos compilados del frontend. El wildcard `*` actúa como SPA fallback: cualquier ruta que no empiece con `/api` devuelve `index.html` para que React Router maneje la navegación del lado del cliente.

`process.pkg` es una propiedad inyectada por el empaquetador `pkg` cuando el proyecto se compila como binario ejecutable; en ese caso el frontend está embebido en una ruta relativa diferente al binario.

---

## Error handler global

```ts
app.use(errorHandler);
```

Debe registrarse **último**, después de todos los routers. Express lo reconoce como error handler por tener 4 parámetros `(err, req, res, next)`. Cualquier error propagado con `next(err)` desde cualquier router llega aquí.
