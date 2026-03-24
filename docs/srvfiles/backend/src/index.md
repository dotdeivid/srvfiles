# index.ts

**Archivo:** `src/index.ts`
**Rol:** Punto de entrada del servidor. Configura Express, registra rutas, sirve el frontend en producción, e inicia el servidor HTTP + WebSocket.

---

## ¿Qué es Express?

Express es el framework web más popular de Node.js. Permite definir endpoints HTTP (GET, POST, DELETE, etc.) con una API simple. El objeto `app` que se crea aquí es toda la aplicación web.

---

## Configuración de Express

```ts
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
```

### `app.use(...)` — Middlewares globales

Un **middleware** es una función que se ejecuta antes de que llegue a las rutas. Aquí se registran tres:

- **`cors({ origin: '*' })`**: permite peticiones desde cualquier origen (cualquier IP, cualquier puerto). Sin esto, los navegadores bloquearían las peticiones del frontend al backend en modo dev (donde tienen puertos diferentes).
- **`express.json()`**: parsea el cuerpo de las peticiones con `Content-Type: application/json` y lo pone en `req.body`.
- **`express.urlencoded({ extended: true })`**: parsea el cuerpo de peticiones de formularios HTML clásicos (`application/x-www-form-urlencoded`).

---

## Registro de rutas

```ts
app.use('/api/files', filesRouter);
app.use('/api/health', healthRouter);
app.use('/api/config', configRouter);
app.use('/api/discovery', discoveryRouter);
```

Cada router maneja un prefijo de ruta. Por ejemplo, `filesRouter` maneja todas las rutas que empiezan con `/api/files`.

---

## Servir el frontend en producción

```ts
const FRONTEND_DIST = (process as any).pkg
  ? path.join(__dirname, '..', '..', 'frontend', 'dist')
  : path.resolve(process.cwd(), '..', 'frontend', 'dist');

app.use(express.static(FRONTEND_DIST));
```

### ¿Qué es `express.static`?

Sirve archivos estáticos (HTML, CSS, JS, imágenes) desde un directorio. Cuando el navegador pide `/index.html` o `/assets/main.js`, Express busca ese archivo en `FRONTEND_DIST` y lo envía directamente.

### Lógica de la ruta

- **`process.pkg`**: propiedad inyectada por `pkg` (el empaquetador que convierte el proyecto en un binario). Si existe, el binario tiene el frontend embebido en una ruta diferente.
- Si no hay `process.pkg` (modo dev): busca `../frontend/dist` relativo al directorio de trabajo.

### SPA Fallback

```ts
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'), (err) => {
      if (err) {
        res.status(404).json({ error: 'Frontend not built. Run: cd frontend && npm run build' });
      }
    });
  }
});
```

En una **Single Page Application** (SPA), toda la navegación la maneja JavaScript en el cliente. Si el usuario refresca en `/settings` (una ruta de React), el servidor no tiene ese archivo — devolvería 404. Este handler atrapa cualquier ruta que no empiece con `/api` y devuelve `index.html`, dejando que React Router maneje la navegación.

---

## Servidor HTTP + WebSocket

```ts
const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', handleConnection);

server.listen(PORT, HOST, () => { ... });
```

### ¿Por qué crear un `http.Server` en lugar de usar `app.listen()`?

Express puede escuchar directamente con `app.listen()`, pero eso crea un servidor HTTP que Express controla. Para agregar WebSockets al mismo puerto, necesitamos acceso al servidor HTTP subyacente. `http.createServer(app)` crea el servidor explícitamente, y luego tanto Express como el WebSocketServer lo comparten.

### WebSocketServer

- **`{ server, path: '/ws' }`**: el WebSocketServer se "engancha" al servidor HTTP existente. Solo acepta upgrades de WebSocket en la ruta `/ws`.
- **`wss.on('connection', handleConnection)`**: cada nueva conexión WebSocket es manejada por `handleConnection` del `transfer.service`.

### `HOST = '0.0.0.0'`

Escucha en todas las interfaces de red de la máquina (no solo `localhost`). Esto es necesario para que otros dispositivos en la red puedan conectarse.

### Callback de inicio

```ts
server.listen(PORT, HOST, () => {
  const lanIp = getLanIp();
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${lanIp}:${PORT}`);
});
```

Se ejecuta una sola vez cuando el servidor está listo. Imprime las URLs de acceso.
