# ConfirmModal.tsx

**Archivo:** `src/components/ConfirmModal.tsx`
**Rol:** Modal genérico de confirmación que reemplaza al `window.confirm()` del navegador.

---

## ¿Qué es un modal?

Un modal es una ventana que aparece sobre el contenido de la página, bloqueando la interacción con todo lo demás hasta que el usuario toma una decisión. En este proyecto, los modales se implementan con un overlay oscuro semitransparente de fondo y un cuadro centrado encima.

---

## Props (parámetros de entrada)

```tsx
interface ConfirmModalProps {
  isOpen: boolean;           // ¿Está visible el modal?
  title: string;             // Título del modal (ej: "Eliminar archivo")
  message: string;           // Mensaje descriptivo para el usuario
  onConfirm: () => void;     // Qué hacer al confirmar
  onCancel: () => void;      // Qué hacer al cancelar
  confirmLabel?: string;     // Texto del botón de acción (por defecto: "Eliminar")
  confirmVariant?: 'danger' | 'primary'; // Color del botón (por defecto: "danger" = rojo)
}
```

El signo `?` en `confirmLabel?` y `confirmVariant?` significa que son opcionales — si no se pasan, se usan los valores por defecto definidos en la firma de la función.

---

## Función `ConfirmModal`

```tsx
export function ConfirmModal({
  isOpen, title, message, onConfirm, onCancel,
  confirmLabel = 'Eliminar',
  confirmVariant = 'danger',
}: ConfirmModalProps) {
  if (!isOpen) return null;
  ...
}
```

### Patrón: renderizado condicional con early return

```tsx
if (!isOpen) return null;
```

Si el modal no está abierto, el componente no renderiza nada (`null`). Esto es más eficiente que ocultarlo con CSS, porque React directamente no monta el árbol de elementos en el DOM.

### Estructura JSX

```tsx
<div className="modal-overlay" onClick={onCancel}>        {/* Fondo oscuro */}
  <div className="modal" onClick={(e) => e.stopPropagation()}>  {/* Cuadro del modal */}
    <div className="modal__header">
      <h3 className="modal__title">{title}</h3>
    </div>
    <div className="modal__body">
      <p className="modal__message">{message}</p>
    </div>
    <div className="modal__footer">
      <button className="btn btn--secondary" onClick={onCancel}>Cancelar</button>
      <button className={`btn btn--${confirmVariant}`} onClick={onConfirm}>{confirmLabel}</button>
    </div>
  </div>
</div>
```

#### Truco: cerrar haciendo clic fuera

El overlay tiene `onClick={onCancel}`, de modo que hacer clic en el fondo oscuro cierra el modal.

El cuadro interno tiene `onClick={(e) => e.stopPropagation()}`. `stopPropagation()` impide que el clic en el cuadro se "propague" hacia el overlay, evitando que se cierre cuando el usuario hace clic dentro del modal.

#### Clases dinámicas

```tsx
className={`btn btn--${confirmVariant}`}
```

Usa template literals para generar el nombre de clase dinámicamente. Si `confirmVariant` es `'danger'`, la clase resultante es `btn btn--danger` (botón rojo). Si es `'primary'`, es `btn btn--primary` (botón violeta).

---

## ¿Cómo se usa en la app?

`App.tsx` controla este modal con dos variables de estado:

```tsx
const [confirmOpen, setConfirmOpen] = useState(false);
const [pendingDelete, setPendingDelete] = useState<string | null>(null);
```

Cuando el usuario hace clic en "borrar" en un archivo:
1. Se guarda el nombre del archivo en `pendingDelete`.
2. Se abre el modal (`confirmOpen = true`).
3. Si confirma → `handleConfirmDelete()` borra el archivo.
4. Si cancela → `handleCancelDelete()` limpia el estado.
