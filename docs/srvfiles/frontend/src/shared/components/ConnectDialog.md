# ConnectDialog.tsx

**Archivo:** `frontend/src/shared/components/ConnectDialog.tsx`
**Rol:** Todo lo necesario para sumar un dispositivo, en un solo lugar.

---

Tres pasos numerados: QR con la URL HTTPS (y la dirección con botón de copiar), aceptar el certificado autofirmado la primera vez y el PIN en grande (`123 456`). Solo se ofrece en el propio equipo servidor (el único que conoce su PIN), desde el botón del header y desde la tarjeta "Todavía no hay otros dispositivos".

El QR usa módulos oscuros sobre fondo blanco con margen: muchos lectores no reconocen los QR invertidos. HTTPS da contexto seguro en el celular (cifrado y portapapeles).

`lanHttpsUrl(config)` devuelve `https://<lanIp>:<httpsPort>`, o `null` si todavía no se conoce la IP.
