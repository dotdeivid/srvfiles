# PinDialog.tsx

**Archivo:** `src/components/PinDialog.tsx`
**Rol:** Modal de autenticación PIN que aparece cuando el servidor activo responde con 401. Usado por `useAuth` para servidores remotos o cuando la auto-autenticación falla.

---

## Props

```tsx
interface PinDialogProps {
  isOpen: boolean;
  serverUrl: string;  // URL completa del servidor (ej: "http://192.168.1.5:3001")
  error?: string | null;
  onSubmit: (pin: string) => void;
}
```

- `serverUrl`: se muestra en el subtítulo del modal para identificar a qué servidor se está conectando. Se extrae el host (sin `http://`) para mostrarlo como `pin-modal__host`.
- `error`: mensaje de error externo (ej: "PIN incorrecto") gestionado por `useAuth`.

---

## Comportamiento

```tsx
useEffect(() => {
  if (isOpen) {
    setPin('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }
}, [isOpen]);
```

Cada vez que el modal se abre, el campo PIN se limpia automáticamente y el input recibe el foco.

---

## Estructura visual

```tsx
<div className="modal-overlay">
  <div className="pin-modal">
    <h3 className="pin-modal__title">Conectarse a servidor</h3>
    <p className="pin-modal__subtitle">
      Ingrese el pin del servidor <span className="pin-modal__host">{host}</span> para conectarse
    </p>
    <form className="pin-modal__row">
      <input className="pin-modal__input" ... />
      <button type="submit" className="btn btn--primary btn--sm">Conectar</button>
    </form>
    {error && <p className="pin-modal__error">{error}</p>}
  </div>
</div>
```

El input y el botón "Conectar" están en la misma fila (`pin-modal__row`) con altura y border-radius coincidentes. El modal no tiene botón de cerrar — el usuario debe ingresar un PIN válido. El overlay no tiene handler `onClick`, por lo que no se puede cerrar haciendo clic fuera.

---

## Diferencia con el prompt de PIN en `ServerSwitcherModal`

`PinDialog` es el modal de autenticación **reactiva**: aparece cuando el servidor ya activo devuelve 401 (gestionado por `useAuth`). El prompt de PIN en `ServerSwitcherModal` es **pre-auth**: aparece antes de cambiar el servidor activo, para autenticar el destino de antemano. Ambos usan las mismas clases CSS (`pin-modal`).
