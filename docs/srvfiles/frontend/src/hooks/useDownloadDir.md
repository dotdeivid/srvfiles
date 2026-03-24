# useDownloadDir.ts

**Archivo:** `src/hooks/useDownloadDir.ts`
**Rol:** Provee dos utilidades para manejar archivos recibidos: detectar si la app corre en Tauri, y guardar un archivo recibido en disco (con estrategia diferente según el entorno).

---

## Constante

```ts
const SUBFOLDER = import.meta.env.VITE_SUBFOLDER ?? 'SrvFiles';
```

Nombre de la subcarpeta que se crea dentro de Descargas del sistema para guardar los archivos recibidos. Se lee de la variable de entorno `VITE_SUBFOLDER` (definida en `.env`); si no está, usa `'SrvFiles'` como valor por defecto.

---

## Función `isTauriApp`

```ts
export function isTauriApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
```

Detecta si la app está corriendo dentro de un webview de Tauri. Tauri inyecta el objeto global `__TAURI_INTERNALS__` en `window` cuando la página se ejecuta dentro de su contenedor.

- `typeof window !== 'undefined'`: previene errores en entornos SSR (server-side rendering) donde `window` no existe.
- `'__TAURI_INTERNALS__' in window`: verifica la presencia de la propiedad sin acceder a su valor.

Esta función es el **único punto de verdad** para detectar Tauri en toda la app.

---

## Función `saveReceivedFile`

```ts
export async function saveReceivedFile(fileName: string, blob: Blob): Promise<string | null>
```

Guarda un archivo recibido por transferencia directa. La estrategia difiere según el entorno:

### Rama Tauri

```ts
if (isTauriApp()) {
  try {
    const { downloadDir } = await import('@tauri-apps/api/path');
    const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs');

    const dir = `${await downloadDir()}/${SUBFOLDER}`;
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/${fileName}`, new Uint8Array(await blob.arrayBuffer()));
    return `${dir}/${fileName}`;
  } catch (e) {
    console.error('[saveReceivedFile] Tauri write failed, falling back to browser download:', e);
    // fall through
  }
}
```

1. **`downloadDir()`**: API de Tauri que devuelve la ruta a la carpeta de Descargas del sistema operativo (ej: `/Users/deivid/Downloads`).
2. **`mkdir(dir, { recursive: true })`**: crea `Downloads/SrvFiles/` si no existe. `recursive: true` no falla si ya existe.
3. **`blob.arrayBuffer()`**: convierte el `Blob` a `ArrayBuffer` para poder pasarlo como `Uint8Array` (array de bytes sin signo) al filesystem.
4. **`writeFile`**: escribe los bytes en el archivo del sistema.
5. Si algo falla, registra el error y hace "fall through" al método del navegador.

#### Importaciones dinámicas

```ts
const { downloadDir } = await import('@tauri-apps/api/path');
```

Las APIs de Tauri se importan **dinámicamente** (dentro de la función, con `await import()`). Esto es necesario porque en el navegador, esos módulos no existen y darían error al importarlos en el nivel superior del archivo. La importación dinámica solo se ejecuta cuando se llama a la función.

### Rama Navegador (fallback)

```ts
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = fileName;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
return null;
```

Técnica estándar para descargar un archivo desde JavaScript en el navegador:

1. **`URL.createObjectURL(blob)`**: crea una URL temporal que apunta al blob en memoria (ej: `blob:http://localhost/abc-123`).
2. Se crea un enlace `<a>` invisible con `href` a esa URL y `download` con el nombre del archivo.
3. Se agrega al DOM, se hace `.click()` programáticamente, y se elimina.
4. **`URL.revokeObjectURL(url)`**: libera la memoria de la URL temporal.
5. Retorna `null` porque no hay una ruta de archivo real (el navegador maneja la descarga).

---

## ¿Por qué `async/await`?

Tanto las APIs de Tauri como `blob.arrayBuffer()` son asíncronas — trabajan con promesas. `async/await` es azúcar sintáctica que permite escribir código asíncrono de forma secuencial y legible, evitando el anidamiento de `.then().then().then()`.
