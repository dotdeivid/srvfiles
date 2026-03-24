# vite-env.d.ts

**Archivo:** `src/vite-env.d.ts`
**Rol:** Declaración de tipos para el entorno de Vite.

---

## ¿Qué hace este archivo?

```ts
/// <reference types="vite/client" />
```

Esta única línea le dice a TypeScript que incluya las definiciones de tipos que provee Vite. Con esto, TypeScript entiende cosas como:

- `import.meta.env` — acceso a variables de entorno (como `VITE_API_URL`, `VITE_APP_NAME`).
- `import.meta.env.PROD` — booleano que es `true` en build de producción.
- `import.meta.env.DEV` — booleano que es `true` en modo desarrollo.
- Importaciones especiales de Vite como `import logo from './logo.svg?url'`.

---

## ¿Por qué es necesario?

Vite agrega propiedades personalizadas al objeto estándar `import.meta` de JavaScript. Sin este archivo, TypeScript no sabría que esas propiedades existen y marcaría errores de tipo en todos los lugares donde se usa `import.meta.env`.

---

## ¿Cuándo tocarlo?

Casi nunca. Solo si necesitás agregar tipos personalizados para tus propias variables de entorno. Por ejemplo, para que TypeScript conozca `VITE_MY_VAR` con un tipo específico, podrías agregar:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MY_VAR: string;
}
```
