# QRFooter.tsx

**Archivo:** `src/components/QRFooter.tsx`
**Rol:** Pie de página que muestra un código QR para acceder a la app desde un dispositivo móvil.

---

## Props

```tsx
interface QRFooterProps {
  config: AppConfig | null;
}
```

Recibe la configuración del servidor (puede ser `null` mientras carga). La configuración incluye la IP LAN, el puerto del backend, y el puerto del frontend.

---

## Función `getLanUrl`

```tsx
const getLanUrl = (): string => {
  if (config?.lanIp) {
    const port = import.meta.env.PROD ? config.port : (config.frontendPort || 5173);
    return `http://${config.lanIp}:${port}`;
  }
  return window.location.origin;
};
```

Calcula la URL que se codificará en el QR. La lógica de puertos es:

| Contexto | Puerto usado | Razón |
|---|---|---|
| Producción (`PROD = true`) | `config.port` (3001) | En producción, el frontend es servido por Express en el puerto del backend. |
| Desarrollo (`PROD = false`) | `config.frontendPort` (5173) | En dev, Vite corre en un puerto separado. |
| Sin config | `window.location.origin` | Fallback: la URL actual del navegador (funciona si ya estás en la IP correcta). |

### ¿Por qué importa esto?

Si el QR apunta a `192.168.1.5:5173` (el puerto de Vite), solo funciona desde la misma máquina. Un celular en la red necesita el puerto correcto donde está disponible el frontend.

---

## Renderizado

```tsx
<footer className="qr-footer">
  <div className="qr-footer__content">
    <h3>Accedé desde tu celular</h3>
    <p>Escaneá el código QR para abrir la app</p>
    <div className="qr-footer__code">
      <QRCodeSVG
        value={lanUrl}         // La URL codificada en el QR
        size={140}             // 140x140 píxeles
        bgColor="transparent"  // Fondo transparente (hereda el del tema)
        fgColor="#c4b5fd"      // Color violeta del tema
        level="M"              // Nivel de corrección de errores (Medium)
        includeMargin={false}
      />
    </div>
    <p className="qr-footer__copyright">
      © 2026 Carlos David Sandoval ·{' '}
      <a href="https://github.com/dotdeivid" target="_blank" rel="noopener noreferrer">
        github.com/dotdeivid
      </a>
    </p>
  </div>
</footer>
```

### Atributos del enlace externo

```tsx
target="_blank"           // Abre en una nueva pestaña
rel="noopener noreferrer" // Seguridad: evita que la página abierta acceda a window.opener
```

`rel="noopener noreferrer"` es una buena práctica de seguridad. Sin él, una página maliciosa abierta con `target="_blank"` podría manipular la página original desde JavaScript.

---

## Librería `qrcode.react`

`QRCodeSVG` es un componente de la librería `qrcode.react` que genera un QR como SVG vectorial (escalable sin pixelarse). El prop `value` es el texto que se codifica — en este caso, una URL.
