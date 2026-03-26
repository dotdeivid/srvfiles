# useDeviceName.ts

**Archivo:** `src/hooks/useDeviceName.ts`
**Rol:** Hook personalizado que gestiona el nombre de dispositivo del usuario. En el primer uso asigna automáticamente un nombre aleatorio y lo persiste en `localStorage` sin mostrar ningún modal. El usuario puede cambiarlo manualmente tocando el nombre en el header.

---

## Concepto: Custom Hook

Un **hook personalizado** es simplemente una función que empieza con `use` y puede llamar a otros hooks de React (`useState`, `useEffect`, etc.). Se usa para extraer lógica reutilizable de los componentes.

---

## Datos en el archivo

### Constante de almacenamiento

```ts
const STORAGE_KEY = import.meta.env.VITE_STORAGE_KEY ?? 'srvfiles-device-name';
```

La clave de `localStorage` donde se guarda el nombre.

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

Genera un nombre aleatorio combinando un adjetivo y un animal.

---

## Hook `useDeviceName`

### Estado inicial con función lazy

```ts
const [deviceName, setDeviceName] = useState<string>(() => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved;
  const name = randomName();
  localStorage.setItem(STORAGE_KEY, name);  // Auto-guardar en primer uso
  return name;
});
```

`useState` acepta una función como argumento inicial (llamada "lazy initializer"). Se ejecuta **solo una vez** al montar el componente:
- Si hay un nombre guardado en `localStorage`, lo usa.
- Si no, genera uno aleatorio, lo guarda inmediatamente en `localStorage`, y lo usa.

El nombre se persiste en el primer uso **sin mostrar ningún modal** — el usuario siempre tiene un nombre válido desde el arranque.

### Función `saveName`

```ts
const saveName = (name: string) => {
  const trimmed = name.trim() || deviceName;
  localStorage.setItem(STORAGE_KEY, trimmed);
  setDeviceName(trimmed);
};
```

Persiste el nombre elegido manualmente:
1. Elimina espacios al inicio y fin.
2. Si el resultado está vacío, usa el nombre actual.
3. Guarda en `localStorage`.
4. Actualiza el estado.

### Valor retornado

```ts
return { deviceName, showNameModal, saveName };
```

- `deviceName`: nombre actual del dispositivo.
- `showNameModal`: siempre `false` en el hook; el modal se controla externamente desde `App.tsx` con el estado `renameOpen`.
- `saveName`: función para cambiar el nombre.
