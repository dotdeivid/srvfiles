# sanitize.ts

**Archivo:** `src/utils/sanitize.ts`
**Rol:** Función de seguridad que limpia nombres de archivo recibidos del cliente para evitar ataques de path traversal y caracteres problemáticos en el sistema de archivos.

---

## ¿Qué es un ataque de path traversal?

Si un servidor guarda archivos con el nombre que el cliente envía sin validarlo, un atacante podría enviar un nombre como `../../etc/passwd` o `../config.env`. El servidor lo trataría como una ruta relativa y potencialmente sobreescribiría o leería archivos fuera del directorio de uploads.

---

## Función `sanitizeFilename`

```ts
export function sanitizeFilename(filename: string): string {
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error(`Invalid filename: "${filename}" contains forbidden characters`);
  }
  ...
}
```

### Paso 1: Rechazo temprano (path traversal)

Si el nombre contiene `..`, `/` (separador de ruta Unix), o `\\` (separador Windows), lanza un error inmediatamente. Estos caracteres son la base de todos los ataques de path traversal.

### Paso 2: Limpieza de caracteres no seguros

```ts
let sanitized = filename.replace(/[^\w\s.\-()[\]]/g, '_');
```

Reemplaza con `_` cualquier carácter que no sea:
- `\w`: letras, números, guión bajo.
- `\s`: espacios.
- `.\-()[]`: punto, guión, paréntesis, corchetes.

Ejemplo: `"foto #1.jpg"` → `"foto _1.jpg"`.

### Paso 3: Espacios a guión bajo

```ts
sanitized = sanitized.replace(/[\s]+/g, '_');
```

Reemplaza uno o más espacios consecutivos con un guión bajo. Los espacios en nombres de archivo causan problemas en URLs y en algunos sistemas operativos.

### Paso 4: Eliminar puntos/espacios al inicio y fin

```ts
sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');
```

Los archivos que empiezan con `.` son ocultos en Unix. Los que terminan en `.` pueden causar problemas en Windows.

La regex usa `|` para hacer dos reemplazos en uno: `^[.\s]+` (al inicio) y `[.\s]+$` (al final).

### Paso 5: Fallback si quedó vacío

```ts
if (!sanitized) {
  sanitized = `file_${Date.now()}`;
}
```

Si después de toda la limpieza el nombre quedó vacío, genera uno con un timestamp (ej: `file_1710640000000`).

---

## Ejemplos de transformación

| Entrada | Salida |
|---|---|
| `"foto.jpg"` | `"foto.jpg"` |
| `"mi foto 2024.png"` | `"mi_foto_2024.png"` |
| `"archivo (1).zip"` | `"archivo_(1).zip"` |
| `"../../etc/passwd"` | **Error** |
| `"../config.env"` | **Error** |
| `"<script>.js"` | `"_script_.js"` |
| `"...hidden"` | `"hidden"` |
| `"👍.png"` | `"_.png"` |

---

## ¿Dónde se usa?

- **`middleware/upload.ts`**: en la función `filename` de Multer para nombrar el archivo en disco.
- **`services/files.service.ts`**: en `resolveFilePath` y `deleteFile` para validar nombres de archivo de los parámetros de URL antes de acceder al disco.
