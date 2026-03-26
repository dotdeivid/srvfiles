# NameModal.tsx

**Archivo:** `src/components/NameModal.tsx`
**Rol:** Modal para que el usuario cambie el nombre de su dispositivo. Se abre cuando el usuario hace clic en el nombre en el header. No se muestra automáticamente en el primer arranque — el nombre se auto-asigna al iniciar.

---

## Props

```tsx
interface NameModalProps {
  isOpen: boolean;              // ¿Está visible el modal?
  defaultName: string;          // Nombre sugerido (generado aleatoriamente por useDeviceName)
  onSave: (name: string) => void; // Callback al guardar
}
```

---

## Estado interno

```tsx
const [value, setValue] = useState(defaultName);
const inputRef = useRef<HTMLInputElement>(null);
```

- **`value`**: el texto actual en el input del modal.
- **`inputRef`**: una referencia directa al elemento `<input>` del DOM, usada para seleccionar su texto automáticamente cuando el modal abre.

---

## Efecto: sincronizar el input cuando el modal abre

```tsx
useEffect(() => {
  if (isOpen) {
    setValue(defaultName);
    setTimeout(() => inputRef.current?.select(), 50);
  }
}, [isOpen, defaultName]);
```

- Cuando `isOpen` cambia a `true`, resetea el input al nombre sugerido.
- `setTimeout(..., 50)`: pequeña demora para asegurarse de que el DOM ya montó el input antes de intentar seleccionar su contenido. `?.select()` usa optional chaining: si `inputRef.current` es `null`, no falla.
- Efecto con dependencias `[isOpen, defaultName]`: solo se ejecuta cuando alguno de los dos cambia.

---

## Early return

```tsx
if (!isOpen) return null;
```

Si el modal no está abierto, no renderiza nada.

---

## Función `handleSubmit`

```tsx
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();  // Evita que el form recargue la página
  onSave(value);
};
```

`e.preventDefault()` es necesario porque por defecto, enviar un formulario HTML recarga la página. En React, siempre se previene ese comportamiento y se maneja el submit manualmente.

---

## Estructura del modal

```tsx
<div className="modal-overlay">  {/* Sin onClick: este modal no se puede cerrar haciendo clic afuera */}
  <div className="modal name-modal">
    <div className="modal__header">
      <h3>¿Cómo se llama este dispositivo?</h3>
    </div>
    <div className="modal__body">
      <p>Este nombre se muestra a otros dispositivos cuando usás el envío directo.</p>
      <form id="name-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Nombre del dispositivo"
          maxLength={32}
          autoFocus
        />
      </form>
    </div>
    <div className="modal__footer">
      <button type="button" onClick={() => onSave('')}>Omitir</button>
      <button type="submit" form="name-form">Guardar</button>
    </div>
  </div>
</div>
```

### Puntos destacados

- **`autoFocus`**: el input recibe el foco automáticamente cuando aparece el modal.
- **`maxLength={32}`**: limita el nombre a 32 caracteres.
- **`form="name-form"`**: el botón "Guardar" fuera del `<form>` puede enviar el formulario usando el atributo `form` que referencia el `id` del form. Esto permite que presionar Enter en el input o hacer clic en "Guardar" tengan el mismo efecto.
- **"Omitir"**: llama a `onSave('')`. En `useDeviceName.saveName`, un string vacío mantiene el nombre aleatorio generado.

---

## Concepto: `useRef`

`useRef` crea una referencia mutable que persiste entre renders sin causar re-renders. Se usa principalmente para:
1. Acceder directamente a elementos del DOM (como `inputRef.current.select()`).
2. Guardar valores que necesitan persistir entre renders pero que no son estado visible.
