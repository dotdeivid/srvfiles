# IncomingTransferModal.tsx

**Archivo:** `frontend/src/features/transfer/IncomingTransferModal.tsx`
**Rol:** Diálogo de solicitud entrante con código de verificación.

---

Muestra remitente (con el ícono de su tipo de dispositivo si sigue conectado, prop `sender`), archivo y tamaño. Lo principal es el código de 6 dígitos (`.sas-panel`): grande, centrado y con la instrucción "Comprobá que {emisor} ve este mismo código. Si no coincide, rechazá." Los botones son **Rechazar** y **Coincide, recibir**; el foco arranca en Rechazar para que un Enter apurado no acepte. Sobre `Dialog` sin `onClose`: ni Esc ni el clic fuera rechazan. Una barra y el texto "Se rechaza sola en N s" muestran el tiempo que queda (`expiresAt`, se pone en ámbar en los últimos 10 s); el texto es `role="timer"` para no anunciarse en cada segundo. Indica cuántas solicitudes más hay en cola.
