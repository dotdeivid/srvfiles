# DiskStats.tsx

**Archivo:** `src/components/DiskStats.tsx`
**Rol:** Indicador visual de espacio en disco en el header de la app.

---

## Props

```tsx
interface DiskStatsProps {
  stats: DiskStatsType | null;
}
```

Recibe `stats`, que puede ser `null` (cuando los datos todavía no cargaron) o un objeto con:
- `total`: espacio total en bytes.
- `used`: espacio usado en bytes.
- `free`: espacio libre en bytes.

---

## Función `DiskStats`

### Early return si no hay datos

```tsx
if (!stats) return null;
```

Si `stats` es `null`, no renderiza nada. El header simplemente no muestra el indicador hasta que el servidor responda.

### Cálculo de porcentaje y niveles de alerta

```tsx
const usedPercent = Math.round((stats.used / stats.total) * 100);
const isWarning  = usedPercent > 80;
const isCritical = usedPercent > 95;
```

- `usedPercent`: porcentaje de disco usado (0–100).
- `isWarning`: activa estilos de advertencia (naranja) cuando el disco supera el 80%.
- `isCritical`: activa estilos críticos (rojo) cuando supera el 95%.

### Renderizado

```tsx
<div className="disk-stats">
  <div className="disk-stats__bar">
    <div
      className={`disk-stats__fill ${isCritical ? 'disk-stats__fill--critical' : isWarning ? 'disk-stats__fill--warning' : ''}`}
      style={{ width: `${usedPercent}%` }}
    />
  </div>
  <span className="disk-stats__text">
    {formatBytes(stats.used)} / {formatBytes(stats.total)}
  </span>
</div>
```

- **Barra de progreso**: un `<div>` exterior que actúa como contenedor (100% de ancho), y un `<div>` interior cuyo ancho se ajusta dinámicamente con `style={{ width: '${usedPercent}%' }}`.
- **Clases condicionales**: usa un operador ternario anidado para aplicar la clase correcta según el nivel de uso.
- **Texto**: muestra los bytes formateados legiblemente con `formatBytes()` (ej: `"12.4 GB / 50 GB"`).

---

## Concepto: estilos en línea con `style`

En React, los estilos en línea se pasan como un objeto JavaScript, no como un string CSS:

```tsx
// React ✅
style={{ width: `${usedPercent}%` }}

// HTML normal ❌ (no funciona en React)
style="width: 75%"
```

Esto es útil cuando el valor es dinámico (como el porcentaje del disco) y no se puede predeterminar en CSS.
