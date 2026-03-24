# DropZone.tsx

**Archivo:** `src/components/DropZone.tsx`
**Rol:** Área de drag & drop para subir archivos. Funciona tanto en el navegador como en la app de escritorio (Tauri).

---

## Props

```tsx
interface DropZoneProps {
  onUpload: (files: File[]) => Promise<boolean>;  // Función para subir archivos al servidor
  uploading: boolean;                              // ¿Hay una subida en curso?
  uploadProgress: number;                          // Progreso de la subida (0–100)
}
```

---

## Estado interno

```tsx
const [stagedFiles, setStagedFiles] = useState<File[]>([]);
const [tauriDragActive, setTauriDragActive] = useState(false);
```

- **`stagedFiles`**: archivos seleccionados/arrastrados pero todavía no subidos. El usuario puede revisar la lista y luego confirmar la subida.
- **`tauriDragActive`**: indica si hay un arrastre nativo de Tauri en curso (para mostrar el estado visual activo).

---

## El problema del drag & drop en Tauri

En un navegador normal, el HTML5 File API maneja el drag & drop directamente. Pero en Tauri (app de escritorio), el sistema operativo intercepta los eventos de arrastre antes de que lleguen al DOM. Por eso se necesita una solución especial.

### Solución para el navegador: `react-dropzone`

```tsx
const { getRootProps, getInputProps, isDragActive: htmlDragActive } = useDropzone({
  onDrop,
  disabled: uploading,
  noDrag: isTauriApp(),  // Deshabilita el drop HTML en Tauri (lo maneja el evento nativo)
});
```

`useDropzone` es un hook de la librería `react-dropzone` que:
- Genera props para el área de drop (`getRootProps`) y para el input de archivo oculto (`getInputProps`).
- Detecta cuando hay un arrastre activo (`isDragActive`).
- Llama a `onDrop` cuando el usuario suelta archivos.

### Solución para Tauri: `webview.onDragDropEvent`

```tsx
useEffect(() => {
  if (!isTauriApp()) return;  // Solo ejecutar en Tauri

  async function setup() {
    const { getCurrentWebview } = await import('@tauri-apps/api/webview');
    const webview = getCurrentWebview();

    unlisten = await webview.onDragDropEvent(async (event) => {
      const type = event.payload.type;

      if (type === 'enter' || type === 'over') { setTauriDragActive(true); return; }
      if (type === 'leave') { setTauriDragActive(false); return; }

      if (type === 'drop') {
        setTauriDragActive(false);
        const paths = event.payload.paths ?? [];
        // Leer cada archivo desde el sistema de archivos nativo
        const { readFile } = await import('@tauri-apps/plugin-fs');
        for (const filePath of paths) {
          const data = await readFile(filePath);
          const name = filePath.replace(/\\/g, '/').split('/').pop() || 'file';
          files.push(new File([data], name));
        }
        setStagedFiles((prev) => [...prev, ...files]);
      }
    });
  }

  setup();
  return () => { unlisten?.(); };  // Cleanup: deregistra el listener al desmontar
}, [uploading]);
```

El evento nativo de Tauri provee **rutas de archivo** (strings como `/Users/deivid/foto.jpg`), no objetos `File`. Por eso se usa `readFile()` del plugin de filesystem de Tauri para leer el contenido y construir un `File` de JavaScript manualmente.

#### Concepto: `useEffect` y cleanup

`useEffect(() => { ... return () => { ... } }, [deps])` ejecuta código al montar el componente (o cuando cambian las dependencias). La función retornada es el "cleanup" — se ejecuta al desmontar, evitando memory leaks.

---

## Función `onDrop` (callback para el navegador)

```tsx
const onDrop = useCallback((acceptedFiles: File[]) => {
  setStagedFiles((prev) => [...prev, ...acceptedFiles]);
}, []);
```

Agrega los archivos arrastrados a la lista `stagedFiles`. Usa el patrón `prev => [...prev, ...nuevos]` para actualizar el estado sin mutar el array original.

---

## Funciones de acción

### `handleUpload`

```tsx
const handleUpload = async () => {
  if (stagedFiles.length === 0) return;
  const success = await onUpload(stagedFiles);
  if (success) setStagedFiles([]);
};
```

Llama a `onUpload` con todos los archivos preparados. Si la subida fue exitosa, limpia la lista de archivos preparados.

### `removeStaged`

```tsx
const removeStaged = (index: number) => {
  setStagedFiles((prev) => prev.filter((_, i) => i !== index));
};
```

Elimina un archivo de la lista por su índice. `filter` crea un nuevo array con todos los elementos excepto el del índice dado.

### `clearAll`

```tsx
const clearAll = () => setStagedFiles([]);
```

Vacía toda la lista de archivos preparados.

---

## Renderizado

### El área de drop

```tsx
<div
  {...getRootProps()}
  className={`dropzone ${isDragActive ? 'dropzone--active' : ''} ${uploading ? 'dropzone--disabled' : ''}`}
>
  <input {...getInputProps()} />
  ...
</div>
```

- `{...getRootProps()}`: spread de todos los event handlers que necesita `react-dropzone` (como `onClick`, `onDrop`, `onDragEnter`, etc.).
- `{...getInputProps()}`: props para el `<input type="file">` oculto que se abre al hacer clic.
- Las clases `dropzone--active` y `dropzone--disabled` modifican el estilo visualmente.

### Preview de archivos preparados

Cuando hay archivos en `stagedFiles` y no está subiendo, muestra:
- Contador de archivos seleccionados.
- Lista con nombre, tamaño, y botón de eliminar por archivo.
- Botón "Subir" para iniciar la subida.

### Barra de progreso

```tsx
{uploading && (
  <div className="upload-progress">
    <div className="upload-progress__fill" style={{ width: `${uploadProgress}%` }} />
    <span>{uploadProgress}%</span>
  </div>
)}
```

Solo se muestra mientras `uploading === true`. El ancho de la barra es dinámico según el progreso.
