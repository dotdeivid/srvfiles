# tlsmux/tlsmux.go

**Archivo:** `backend/internal/tlsmux/tlsmux.go`
**Rol:** Sirve TLS y HTTP plano en el mismo puerto (el HTTPS).

---

Si alguien escribe `192.168.1.5:3002` en el navegador sin `https://`, el navegador habla HTTP a un puerto TLS y la conexión falla sin explicación.

`Split(ln, cfg)` devuelve dos listeners sobre el mismo socket:

- mira el primer byte de cada conexión nueva (`0x16` = handshake TLS), con un límite de 10 s;
- las TLS salen ya envueltas con `cfg` por el primero (servidor HTTPS);
- las demás salen por el segundo, que `main.go` sirve con una redirección a `https://` en el mismo puerto.

La clasificación corre en una goroutine por conexión: un cliente que no manda nada no bloquea a los demás. Cerrar cualquiera de los dos listeners cierra el socket.
