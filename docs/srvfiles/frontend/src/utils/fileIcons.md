# fileIcons.ts

**Archivo:** `src/utils/fileIcons.ts`
**Rol:** Mapeo de extensiones de archivo a emojis representativos para mostrar en la lista de archivos.

---

## Mapa de iconos

```ts
const FILE_ICONS: Record<string, string> = {
  // Documentos
  pdf: '📄', doc: '📝', docx: '📝', txt: '📝',
  // Imágenes
  jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️',
  // Video
  mp4: '🎬', avi: '🎬', mkv: '🎬', mov: '🎬',
  // Audio
  mp3: '🎵', wav: '🎵', flac: '🎵', ogg: '🎵',
  // Archivos comprimidos
  zip: '📦', rar: '📦', '7z': '📦', tar: '📦', gz: '📦',
  // Código
  js: '⚙️', ts: '⚙️', py: '⚙️', java: '⚙️', cpp: '⚙️',
  // Web
  html: '🌐', css: '🌐', json: '🌐',
  // Hojas de cálculo y presentaciones
  xlsx: '📊', xls: '📊', csv: '📊', pptx: '📊', ppt: '📊',
};

const DEFAULT_ICON = '📁';
```

`Record<string, string>` es un tipo de TypeScript que equivale a "un objeto cuyas claves y valores son strings". Es un alias para `{ [key: string]: string }`.

---

## Función `getFileIcon`

```ts
export function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || DEFAULT_ICON;
}
```

### Paso a paso

1. **`filename.split('.')`**: divide el nombre por puntos. `"archivo.tar.gz"` → `["archivo", "tar", "gz"]`.
2. **`.pop()`**: toma el último elemento del array → `"gz"`.
3. **`?.toLowerCase()`**: convierte a minúsculas. El `?.` (optional chaining) maneja el caso donde `pop()` devuelva `undefined` (si no hay punto en el nombre).
4. **`|| ''`**: si `pop()` fue `undefined`, usa string vacío para que la lookup devuelva `undefined` en vez de fallar.
5. **`FILE_ICONS[ext] || DEFAULT_ICON`**: busca el emoji; si no lo encuentra, usa `📁`.

### Ejemplos

| Filename | ext | Resultado |
|---|---|---|
| `foto.jpg` | `jpg` | `🖼️` |
| `video.MP4` | `mp4` | `🎬` |
| `archivo.tar.gz` | `gz` | `📦` |
| `sinextension` | `""` | `📁` |
| `datos.xlsx` | `xlsx` | `📊` |

---

## ¿Por qué un módulo separado?

Centralizar la lógica de iconos en un solo lugar tiene varias ventajas:
- **Fácil de extender**: agregar un nuevo tipo de archivo es cambiar solo este archivo.
- **Reutilizable**: tanto `FileItem` (vista lista) como `FileItem` (vista grilla) usan la misma función.
- **Testeable**: una función pura sin dependencias externas es trivial de testear.
