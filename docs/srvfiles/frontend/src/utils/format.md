# format.ts

**Archivo:** `src/utils/format.ts`
**Rol:** Utilidad para formatear valores numéricos de bytes en texto legible para humanos.

---

## Función `formatBytes`

```ts
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
```

### Parámetros

- `bytes`: número entero de bytes a formatear.

### Retorno

Un string legible para humanos con una unidad apropiada.

### ¿Cómo funciona?

El truco central es `Math.floor(Math.log(bytes) / Math.log(k))`:

- `Math.log(bytes)` es el logaritmo natural de los bytes.
- `Math.log(k)` es el logaritmo natural de 1024.
- La división es el "logaritmo en base 1024" de los bytes.
- `Math.floor` redondea hacia abajo para obtener el índice de la unidad.

**Ejemplos:**

| Bytes | `log(bytes)/log(1024)` | `i` | Unidad | Resultado |
|---|---|---|---|---|
| 0 | — | — | — | `"0 B"` |
| 500 | 0.89 | 0 | B | `"500 B"` |
| 1500 | 1.05 | 1 | KB | `"1.5 KB"` |
| 2_500_000 | 2.35 | 2 | MB | `"2.4 MB"` |
| 1_073_741_824 | 3 | 3 | GB | `"1.0 GB"` |

### `.toFixed(1)`

Formatea el número con exactamente 1 decimal: `"1.46..."` → `"1.5"`.

### `parseFloat(...)`

Convierte el string de `.toFixed(1)` de vuelta a número para eliminar ceros innecesarios: `"2.0"` → `2`, que se imprime como `"2 MB"` en vez de `"2.0 MB"`.

---

## ¿Por qué en su propio módulo?

`formatBytes` se usa en al menos cuatro lugares diferentes:
- `DiskStats`: espacio usado/total en el header.
- `FileItem`: tamaño de cada archivo en lista y grilla.
- `OnlineClients`: tamaño del archivo durante una transferencia.
- `IncomingTransferModal`: tamaño del archivo entrante.

Tenerla en un módulo separado garantiza que siempre se formatee de la misma manera en toda la app.
