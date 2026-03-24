# FileItem.tsx

**Archivo:** `src/components/FileItem.tsx`
**Rol:** Representa un único archivo de la lista. Soporta dos modos de vista: lista (fila de tabla) y grilla (tarjeta).

---

## Props

```tsx
interface FileItemProps {
  file: FileInfo;                           // Datos del archivo (nombre, tamaño, etc.)
  onRequestDelete: (filename: string) => void; // Callback al hacer clic en "borrar"
  viewMode: 'list' | 'grid';               // Cómo mostrar el archivo
  getDownloadUrl: (filename: string) => string; // Función para obtener la URL de descarga
  canDelete: boolean;                       // ¿Puede el usuario borrar este archivo?
}
```

---

## Lógica interna

```tsx
const downloadUrl = getDownloadUrl(file.name);
const handleDelete = () => onRequestDelete(file.name);
```

- **`downloadUrl`**: se calcula una vez al renderizar, llamando a `getDownloadUrl` con el nombre del archivo.
- **`handleDelete`**: función local que llama a `onRequestDelete` con el nombre del archivo. Es un envoltorio para no tener que escribir una arrow function directamente en el JSX.

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
    <a href={downloadUrl} download>...</a>
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
    <a href={downloadUrl} download>...</a>
    {canDelete && <button onClick={handleDelete}>...</button>}
  </td>
</tr>
```

Devuelve un `<tr>` (fila de tabla), diseñado para ir dentro del `<tbody>` del `<FileList>`.

---

## El atributo `download` en el enlace

```tsx
<a href={downloadUrl} download>
```

El atributo `download` en HTML le indica al navegador que debe descargar el archivo en lugar de navegar a esa URL. Sin él, el navegador intentaría abrir el archivo en una nueva pestaña.

---

## Concepto: componentes presentacionales

`FileItem` es un componente "tonto" (dumb/presentational): no tiene estado propio ni efectos. Solo muestra datos y dispara callbacks hacia arriba. Esto lo hace simple de entender, fácil de reutilizar, y trivial de testear.
