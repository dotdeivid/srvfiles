# IncomingTransferModal.tsx

**Archivo:** `frontend/src/features/transfer/IncomingTransferModal.tsx`
**Rol:** Diálogo de solicitud entrante con código de verificación.

---

Muestra remitente (con el ícono de su tipo de dispositivo si sigue conectado, prop `sender`), archivo y tamaño. Lo principal es el código de 6 dígitos (`.sas-panel`): grande, centrado y con la instrucción "Comprobá que {emisor} ve este mismo código. Si no coincide, rechazá." Los botones son **Rechazar** y **Coincide, recibir**; el foco arranca en Rechazar para que un Enter apurado no acepte. Hacer clic fuera no rechaza. Indica cuántas solicitudes más hay en cola.
