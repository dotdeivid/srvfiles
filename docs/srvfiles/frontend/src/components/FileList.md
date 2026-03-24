# FileList.tsx

**Archivo:** `src/components/FileList.tsx`
**Rol:** Contenedor de la lista de archivos. Incluye búsqueda, toggle de vista (lista/grilla), estado de carga y estado vacío.

---

## Props

```tsx
interface FileListProps {
  files: FileInfo[];                           // Lista completa de archivos del servidor
  loading: boolean;                            // ¿Están cargando los archivos?
  onRequestDelete: (filename: string) => void; // Callback para solicitar borrado
  getDownloadUrl: (filename: string) => string; // Función para construir URL de descarga
  canDelete: boolean;                          // ¿Puede el usuario borrar archivos?
}
```

---

## Estado interno

```tsx
const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
const [search, setSearch] = useState('');
```

- **`viewMode`**: controla si los archivos se muestran en lista (tabla) o en grilla (tarjetas). Por defecto: `'list'`.
- **`search`**: el texto actual del buscador. Comienza vacío.

---

## Filtrado de archivos con `useMemo`

```tsx
const filteredFiles = useMemo(() => {
  if (!search.trim()) return files;
  const query = search.toLowerCase();
  return files.filter((f) => f.name.toLowerCase().includes(query));
}, [files, search]);
```

`useMemo` memoriza el resultado del filtrado para no recalcularlo en cada render si `files` y `search` no cambiaron. Solo se recalcula cuando alguno de los dos cambia.

El filtro compara en minúsculas para que la búsqueda no sea sensible a mayúsculas: buscar "foto" encuentra "Foto.JPG".

---

## Estado de carga

```tsx
if (loading) {
  return (
    <div className="file-list__loading">
      <div className="spinner" />
      <p>Cargando archivos...</p>
    </div>
  );
}
```

Early return: mientras los archivos están cargando, muestra solo un spinner.

---

## Toolbar: buscador + toggle de vista

### Buscador

```tsx
<input
  type="text"
  placeholder="Buscar archivos..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
/>
{search && (
  <button onClick={() => setSearch('')}>✕</button>
)}
```

- El input es **controlado**: su valor siempre refleja el estado `search`. Cuando el usuario escribe, `onChange` actualiza el estado, React re-renderiza, y el input muestra el nuevo valor.
- El botón "✕" para limpiar solo aparece cuando `search` tiene contenido (`{search && ...}`).

### Botones de vista

```tsx
<button
  className={`btn-icon ${viewMode === 'list' ? 'btn-icon--active' : ''}`}
  onClick={() => setViewMode('list')}
>
```

El botón activo recibe la clase `btn-icon--active` que lo resalta visualmente.

---

## Estados vacíos

```tsx
{filteredFiles.length === 0 && (
  <div className="file-list__empty">
    {search ? (
      <p>No se encontraron archivos que coincidan con "{search}"</p>
    ) : (
      <p>No hay archivos aún</p>
    )}
  </div>
)}
```

Muestra mensajes diferentes según si el vacío es por el filtro de búsqueda o porque realmente no hay archivos.

---

## Renderizado de archivos

### Lista (tabla)

```tsx
<table className="file-list__table">
  <thead>
    <tr><th>Nombre</th><th>Tamaño</th><th>Acciones</th></tr>
  </thead>
  <tbody>
    {filteredFiles.map((file) => (
      <FileItem key={file.name} file={file} viewMode="list" ... />
    ))}
  </tbody>
</table>
```

### Grilla

```tsx
<div className="file-list__grid">
  {filteredFiles.map((file) => (
    <FileItem key={file.name} file={file} viewMode="grid" ... />
  ))}
</div>
```

---

## Concepto: `key` en listas

```tsx
<FileItem key={file.name} .../>
```

Cuando React renderiza una lista de elementos, necesita una `key` única por elemento para rastrear cuál es cuál entre re-renders. Sin `key`, React podría confundirse al agregar, borrar, o reordenar elementos. Aquí se usa el nombre del archivo como clave, que es único dentro de la lista.

---

## Concepto: input controlado vs no controlado

Un input **controlado** en React tiene su `value` vinculado a una variable de estado:

```tsx
<input value={search} onChange={(e) => setSearch(e.target.value)} />
```

React es la "fuente de verdad" del valor. Esto permite, por ejemplo, limpiar el input programáticamente (`setSearch('')`) o mostrar su valor en otro lugar.
