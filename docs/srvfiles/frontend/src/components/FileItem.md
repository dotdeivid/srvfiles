# FileItem.tsx

**Archivo:** `src/components/FileItem.tsx`
**Rol:** Representa un único archivo de la lista. Soporta dos modos de vista: lista (fila de tabla) y grilla (tarjeta).

---

## Props

```tsx
interface FileItemProps {
  file: FileInfo;
  onRequestDelete: (filename: string) => void;
  viewMode: 'list' | 'grid';
  getDownloadUrl: (filename: string) => string;
  canDelete: boolean;
  previewMaxMb?: number; // Límite en MB para el botón "ver". Default: 1024.
}
```

---

## Lógica interna

```tsx
const downloadUrl = getDownloadUrl(file.name);
const handleDelete = () => onRequestDelete(file.name);
```

- **`downloadUrl`**: se calcula una vez al renderizar, llamando a `getDownloadUrl` con el nombre del archivo.
- **`handleDelete`**: función local que llama a `onRequestDelete` con el nombre del archivo.

---

## Descarga en Tauri — `handleDownload`

```tsx
const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
  if (!isTauriApp()) return; // browser: let the native <a download> handle it
  e.preventDefault();
  const toastId = toast.loading(`Descargando ${file.name}…`);
  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    await saveReceivedFile(file.name, blob);
    toast.success(`${file.name} guardado en Descargas/SrvFiles`, { id: toastId });
  } catch {
    toast.error(`Error al descargar ${file.name}`, { id: toastId });
  }
};
```

En el **navegador**, el clic en el enlace `<a download>` se deja pasar normalmente (el navegador gestiona la descarga). En **Tauri**, el comportamiento estándar se intercepta con `e.preventDefault()` para evitar que el WebView intente previsualizar el archivo. En su lugar:

1. Se hace un `fetch` manual al `downloadUrl` para obtener un `Blob`.
2. Se llama a `saveReceivedFile(file.name, blob)` (del hook `useDownloadDir`) que escribe el archivo en la carpeta `Downloads/SrvFiles` del sistema operativo usando la API de Tauri.
3. Se muestra un toast de éxito o error según el resultado.

---

## Renderizado condicional por `viewMode`

```tsx
if (viewMode === 'grid') {
  return ( /* tarjeta */ );
}

// List view (table row)
return ( /* fila de tabla */ );
```

El componente devuelve estructuras HTML completamente diferentes según el modo de vista.

### Vista grilla (`grid`): tarjeta

```tsx
<div className="file-card">
  <div className="file-card__icon">{getFileIcon(file.name)}</div>
  <div className="file-card__info">
    <span className="file-card__name" title={file.name}>{file.name}</span>
    <span className="file-card__meta">{formatBytes(file.size)}</span>
  </div>
  <div className="file-card__actions">
    <a href={downloadUrl} download onClick={handleDownload}>...</a>
    {canDelete && <button onClick={handleDelete}>...</button>}
  </div>
</div>
```

- `getFileIcon(file.name)`: devuelve un emoji según la extensión del archivo (📄, 🖼️, 🎬, etc.).
- `formatBytes(file.size)`: convierte bytes a texto legible ("1.2 MB").
- `title={file.name}`: tooltip que aparece al hover, útil para nombres largos.
- El botón de borrar solo se renderiza si `canDelete === true`.

### Vista lista (`list`): fila de tabla

```tsx
<tr className="file-row">
  <td className="file-row__name">
    <span>{getFileIcon(file.name)}</span>
    <span title={file.name}>{file.name}</span>
  </td>
  <td className="file-row__size">{formatBytes(file.size)}</td>
  <td className="file-row__actions">
    <a href={downloadUrl} download onClick={handleDownload}>...</a>
    {canDelete && <button onClick={handleDelete}>...</button>}
  </td>
</tr>
```

Devuelve un `<tr>` (fila de tabla), diseñado para ir dentro del `<tbody>` del `<FileList>`.

---

## El atributo `download` en el enlace

```tsx
<a href={downloadUrl} download onClick={handleDownload}>
```

El atributo `download` le indica al navegador que debe descargar el archivo en lugar de navegar a esa URL (aplica solo cuando no hay Tauri). En Tauri, `handleDownload` llama a `e.preventDefault()` antes de que el atributo tenga efecto.

---

## Botón de previsualización

```tsx
const showEye = canPreview(file.name); // utilidad que comprueba la extensión
const handlePreview = () => {
  if (file.size > previewMaxMb * 1024 * 1024) {
    toast.warning(`El archivo es demasiado grande para previsualizar`);
    return;
  }
  setPreviewing(true);
};
```

- `canPreview(filename)` (de `utils/fileTypeHelper`) retorna `true` si la extensión tiene soporte nativo (imagen, SVG, video, audio, PDF, texto).
- Si el archivo supera `previewMaxMb`, se muestra un toast y no se abre el previsualizador.
- El estado `previewing` controla la visibilidad del `PreviewModal`.

### `PreviewModal` y `createPortal`

El modal se renderiza fuera del árbol DOM del componente mediante `ReactDOM.createPortal`:

```tsx
{previewing && createPortal(
  <PreviewModal file={file} downloadUrl={downloadUrl} onClose={() => setPreviewing(false)} />,
  document.body,
)}
```

Esto evita problemas de HTML inválido (el componente puede estar dentro de un `<tr>`) y garantiza que el overlay siempre quede por encima del resto de la UI.

---

## Estado interno

`FileItem` tiene estado (`useState`) para controlar la previsualización. Ya no es un componente puramente presentacional, pero el estado es mínimo y local.
