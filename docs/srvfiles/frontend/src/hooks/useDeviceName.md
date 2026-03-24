# useDeviceName.ts

**Archivo:** `src/hooks/useDeviceName.ts`
**Rol:** Hook personalizado que gestiona el nombre de dispositivo del usuario, generando uno aleatorio en el primer uso y persistiéndolo en `localStorage`.

---

## Concepto: Custom Hook

Un **hook personalizado** es simplemente una función que empieza con `use` y puede llamar a otros hooks de React (`useState`, `useEffect`, etc.). Se usa para extraer lógica reutilizable de los componentes.

---

## Datos en el archivo

### Constante de almacenamiento

```ts
const STORAGE_KEY = import.meta.env.VITE_STORAGE_KEY ?? 'srvfiles-device-name';
```

La clave de `localStorage` donde se guarda el nombre. Se lee de la variable de entorno `VITE_STORAGE_KEY` (definida en `.env`); si no está, usa el valor por defecto. Centralizarla evita typos si se usa en varios lugares.

### Listas para nombre aleatorio

```ts
const ADJECTIVES = ['Rápido', 'Azul', 'Verde', 'Veloz', 'Brillante', 'Tranquilo', 'Creativo', 'Curioso'];
const ANIMALS    = ['Zorro', 'Puma', 'Delfín', 'Águila', 'Jaguar', 'Lobo', 'Oso', 'Cóndor'];
```

Vocabulario para generar nombres como "Rápido Zorro" o "Azul Puma".

---

## Función `randomName`

```ts
function randomName(): string {
  const adj    = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}
```

Genera un nombre aleatorio combinando un adjetivo y un animal. `Math.random()` devuelve un número entre 0 y 1 (exclusivo); multiplicado por la longitud del array y pasado por `Math.floor`, da un índice entero aleatorio válido.

---

## Hook `useDeviceName`

### Estado inicial con función lazy

```ts
const [deviceName, setDeviceName] = useState<string>(() => {
  return localStorage.getItem(STORAGE_KEY) || randomName();
});
```

`useState` acepta una función como argumento inicial (llamada "lazy initializer"). Esta función se ejecuta **solo una vez** al montar el componente:
- Si hay un nombre guardado en `localStorage`, lo usa.
- Si no, genera uno aleatorio.

Usar una función como argumento de `useState` (y no el valor directamente) es importante porque `localStorage.getItem()` y `randomName()` son operaciones que no queremos ejecutar en cada re-render.

La diferencia es:
```ts
// ✅ Con función lazy — se ejecuta solo una vez al montar
useState<string>(() => localStorage.getItem(STORAGE_KEY) || randomName())

// ❌ Sin función — se ejecuta en CADA render
useState<string>(localStorage.getItem(STORAGE_KEY) || randomName())
```

La "función" a la que se hace referencia es el arrow `() => { ... }` que se pasa como argumento a `useState`. React la invoca solo la primera vez; en los siguientes renders la ignora por completo.

### Efecto: mostrar modal en el primer uso

```ts
useEffect(() => {
  if (!localStorage.getItem(STORAGE_KEY)) {
    setShowNameModal(true);
  }
}, []);
```

El array de dependencias vacío `[]` significa que este efecto se ejecuta **solo al montar** el componente (equivalente al `componentDidMount` de clases). Si no hay nombre guardado, muestra el modal para que el usuario pueda personalizar su nombre.

### Función `saveName`

```ts
const saveName = (name: string) => {
  const trimmed = name.trim() || deviceName;  // Si está vacío, usa el nombre actual (aleatorio)
  localStorage.setItem(STORAGE_KEY, trimmed);
  setDeviceName(trimmed);
  setShowNameModal(false);
};
```

Persiste el nombre elegido:
1. Elimina espacios al inicio y fin.
2. Si el resultado está vacío (el usuario omitió o borró todo), usa el nombre aleatorio actual.
3. Guarda en `localStorage`.
4. Actualiza el estado.
5. Cierra el modal.

### Valor retornado

```ts
return { deviceName, showNameModal, saveName };
```

El hook expone exactamente lo que los componentes necesitan — ni más, ni menos.
