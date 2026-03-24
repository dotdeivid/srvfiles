# main.tsx

**Archivo:** `src/main.tsx`
**Rol:** Punto de entrada de la aplicación React.

---

## ¿Qué hace este archivo?

Es el primer archivo que ejecuta el navegador al cargar la app. Su única responsabilidad es montar el componente raíz (`App`) en el DOM.

---

## Línea por línea

### Importaciones

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
```

- **`StrictMode`**: Un componente especial de React que activa advertencias adicionales en desarrollo. No cambia nada en producción — solo te avisa si estás usando APIs obsoletas o si hay problemas potenciales.
- **`createRoot`**: La función moderna de React 18 para montar una app en un nodo del DOM. Reemplaza al viejo `ReactDOM.render()`.
- **`'./index.css'`**: Importa los estilos globales de la app. CSS importado aquí aplica a toda la interfaz.
- **`App`**: El componente raíz que contiene toda la lógica y la UI.

### Montaje

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- **`document.getElementById('root')`**: Busca el elemento `<div id="root">` en el `index.html`. Ese es el "contenedor" donde React va a dibujar toda la app.
- **`!`**: El signo de exclamación le dice a TypeScript "confio en que este elemento existe" (non-null assertion). Si el elemento no existiera, la app fallaría en runtime.
- **`.render(...)`**: Le pide a React que renderice `<App />` dentro de ese contenedor, envuelto en `StrictMode`.

---

## Concepto clave: ¿Qué es "renderizar" en React?

React no modifica el HTML directamente. En cambio, mantiene un árbol virtual de componentes en memoria (el "Virtual DOM") y lo sincroniza con el DOM real del navegador de forma eficiente. `createRoot(...).render(...)` inicia ese proceso.
