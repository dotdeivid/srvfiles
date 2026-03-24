# useFiles.ts

**Archivo:** `src/hooks/useFiles.ts`
**Rol:** Hook principal de gestión de archivos. Maneja el estado de la lista de archivos, el disco, la configuración del servidor, y las operaciones de subir/borrar con polling automático.

---

## Constante

```ts
const POLL_INTERVAL = 5000;
```

Cada 5 segundos se refresca la lista de archivos y las estadísticas de disco en segundo plano.

---

## Tipo de retorno

```ts
interface UseFilesReturn {
  files: FileInfo[];          // Lista de archivos en el servidor
  stats: DiskStats | null;    // Espacio en disco
  config: AppConfig | null;   // Configuración del servidor (IP, puertos, etc.)
  loading: boolean;           // Carga inicial en curso
  uploading: boolean;         // Subida en curso
  uploadProgress: number;     // Progreso de la subida (0–100)
  error: string | null;       // Mensaje de error (si hay)
  fetchFiles: () => Promise<void>;
  fetchStats: () => Promise<void>;
  upload: (files: File[]) => Promise<boolean>;
  remove: (filename: string) => Promise<boolean>;
  getDownloadUrl: (filename: string) => string;
}
```

---

## Hook `useFiles`

```ts
export function useFiles(serverUrl?: string): UseFilesReturn
```

Recibe una URL de servidor opcional. Si no se pasa, usa la URL auto-detectada.

### Instancia de API memoizada

```ts
const api = useMemo(
  () => createFilesApi(serverUrl || getApiUrl()),
  [serverUrl]
);
```

`useMemo` crea la instancia de la API solo cuando `serverUrl` cambia. Sin esto, se crearía un nuevo objeto `api` en cada render, lo que a su vez dispararía todos los efectos que dependen de `api`.

---

## Función `fetchFileList`

```ts
const fetchFileList = useCallback(async () => {
  try {
    setError(null);
    const data = await api.getFiles();
    setFiles(data.files);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch files';
    setError(message);
  }
}, [api]);
```

Hace un GET al endpoint `/api/files`. En éxito, limpia el error y actualiza la lista. En fallo, guarda el mensaje de error.

`useCallback` memoriza la función para que no cambie de referencia entre renders (importante porque esta función se usa como dependencia de otros efectos).

---

## Función `fetchDiskStats`

```ts
const fetchDiskStats = useCallback(async () => {
  try {
    const data = await api.getStats();
    setStats(data);
  } catch (err) {
    console.error('Fetch stats error:', err);
  }
}, [api]);
```

Obtiene el uso de disco. Los errores se logean pero **no se muestran en la UI** — el indicador de disco simplemente no aparece si falla, lo que no es crítico para el usuario.

---

## Función `fetchConfig`

```ts
const fetchConfig = useCallback(async () => {
  try {
    const data = await api.getConfig();
    setConfig(data);
  } catch (err) {
    console.error('Fetch config error:', err);
  }
}, [api]);
```

Obtiene la configuración del servidor (nombre de app, IP LAN, puertos). Se llama **una sola vez** al inicializar, no en el polling.

---

## Función `uploadFile`

```ts
const uploadFile = useCallback(async (filesToUpload: File[]): Promise<boolean> => {
  try {
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    await api.uploadFiles(filesToUpload, (progress) => {
      setUploadProgress(progress);  // Callback llamado conforme avanza la subida
    });

    await Promise.all([fetchFileList(), fetchDiskStats()]);  // Actualizar estado
    return true;
  } catch (err) {
    setError(message);
    return false;
  } finally {
    setUploading(false);
    setUploadProgress(0);
  }
}, [api, fetchFileList, fetchDiskStats]);
```

- `setUploading(true)`: deshabilita el DropZone y muestra la barra de progreso.
- El callback de progreso actualiza `uploadProgress` en tiempo real.
- `Promise.all([...])`: ejecuta dos promesas en paralelo (más rápido que en secuencia).
- `finally`: siempre resetea `uploading` y `uploadProgress`, ya sea que la subida haya salido bien o mal.

---

## Función `removeFile`

```ts
const removeFile = useCallback(async (filename: string): Promise<boolean> => {
  try {
    setError(null);
    await api.deleteFile(filename);
    await Promise.all([fetchFileList(), fetchDiskStats()]);
    return true;
  } catch (err) {
    setError(message);
    return false;
  }
}, [api, fetchFileList, fetchDiskStats]);
```

Llama al DELETE del backend y refresca la lista y el disco en caso de éxito.

---

## Efecto principal: carga inicial + polling

```ts
useEffect(() => {
  setLoading(true);
  setFiles([]);
  setStats(null);
  setConfig(null);

  const init = async () => {
    await Promise.all([fetchFileList(), fetchDiskStats(), fetchConfig()]);
    setLoading(false);
  };
  init();

  pollRef.current = setInterval(() => {
    fetchFileList();
    fetchDiskStats();
  }, POLL_INTERVAL);

  return () => {
    if (pollRef.current) clearInterval(pollRef.current);
  };
}, [fetchFileList, fetchDiskStats, fetchConfig]);
```

1. Resetea el estado para mostrar la pantalla de carga.
2. Hace las tres peticiones iniciales en paralelo.
3. Cuando todas terminan, `loading` pasa a `false`.
4. Inicia el polling cada 5 segundos.
5. **Cleanup**: al desmontar (o cuando `serverUrl` cambia), cancela el intervalo para no hacer peticiones al servidor anterior.

### ¿Por qué `pollRef`?

```ts
const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

Se usa `useRef` para guardar el ID del intervalo porque:
- No es estado visible que deba causar re-renders.
- Necesita persistir entre renders para poder cancelarlo en el cleanup.
