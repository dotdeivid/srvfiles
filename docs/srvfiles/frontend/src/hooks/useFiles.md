# useFiles.ts

**Archivo:** `src/hooks/useFiles.ts`
**Rol:** Hook principal de gestión de archivos. Maneja el estado de la lista de archivos, el disco, la configuración del servidor, y las operaciones de subir/borrar. Los datos se cargan una sola vez al montar (sin polling); las actualizaciones ocurren explícitamente después de cada operación.

---

## Tipo de retorno

```ts
interface UseFilesReturn {
  files: FileInfo[];          // Lista de archivos en el servidor
  stats: DiskStats | null;    // Espacio en disco (libre / total)
  config: AppConfig | null;   // Configuración del servidor (IP, puertos, etc.)
  loading: boolean;           // Carga inicial en curso
  uploading: boolean;         // Subida en curso
  uploadProgress: number;     // Progreso de la subida (0–100)
  error: string | null;       // Mensaje de error (si hay)
  upload: (files: File[]) => Promise<boolean>;
  remove: (filename: string) => Promise<boolean>;
  getDownloadUrl: (filename: string) => string;
}
```

---

## Hook `useFiles`

```ts
export function useFiles(serverUrl: string | null): UseFilesReturn
```

Recibe la URL del servidor. Si es `null` (autenticación pendiente), no hace ninguna petición.

### Instancia de API memoizada

```ts
const api = useMemo(
  () => serverUrl ? createFilesApi(serverUrl) : null,
  [serverUrl]
);
```

`useMemo` crea la instancia de la API solo cuando `serverUrl` cambia. Si `serverUrl` es `null`, no se crea la API.

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

`useCallback` memoriza la función para que no cambie de referencia entre renders.

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

Obtiene el uso de disco. Los errores se logean pero **no se muestran en la UI** — el indicador de disco simplemente no aparece si falla.

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

Obtiene la configuración del servidor (nombre de app, IP LAN, puertos). Se llama **una sola vez** al inicializar.

---

## Función `uploadFile`

```ts
const uploadFile = useCallback(async (filesToUpload: File[]): Promise<boolean> => {
  try {
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    await api.uploadFiles(filesToUpload, (progress) => {
      setUploadProgress(progress);
    });

    await Promise.all([fetchFileList(), fetchDiskStats()]);
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
- `Promise.all([...])`: refresca lista y disco en paralelo después de la subida.
- `finally`: siempre resetea el estado de subida.

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

## Efecto principal: carga inicial

```ts
useEffect(() => {
  if (!api) return;
  setLoading(true);
  setFiles([]);
  setStats(null);
  setConfig(null);

  const init = async () => {
    await Promise.all([fetchFileList(), fetchDiskStats(), fetchConfig()]);
    setLoading(false);
  };
  init();
}, [api, fetchFileList, fetchDiskStats, fetchConfig]);
```

1. Si `api` es `null` (sin serverUrl), no hace nada.
2. Resetea el estado para mostrar la pantalla de carga.
3. Hace las tres peticiones iniciales en paralelo.
4. Cuando todas terminan, `loading` pasa a `false`.

No hay polling: los datos se actualizan únicamente después de operaciones explícitas (subida, eliminación).
