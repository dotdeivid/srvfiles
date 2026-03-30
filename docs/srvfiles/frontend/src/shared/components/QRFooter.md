# QRFooter.tsx

**File:** `src/shared/components/QRFooter.tsx`
**Purpose:** Footer component that renders a QR code pointing to the HTTPS LAN URL of the server. Allows mobile devices to connect by scanning the code.

---

## Exports

### `QRFooter`

**Props:**

```ts
interface QRFooterProps {
  config: AppConfig | null;
}
```

---

## Key behaviors

- **HTTPS URL:** Always points to `https://{config.lanIp}:{config.httpsPort}` when both fields are available. Falls back to `window.location.origin` if `config` is null or incomplete. The HTTPS URL is intentional: it ensures external browsers get a secure context so `crypto.subtle` is available and E2E WebSocket encryption activates automatically.
- **QR code:** Rendered via `QRCodeSVG` from `qrcode.react` at 140×140 px with `bgColor="transparent"` and `fgColor="#c4b5fd"` (the app's violet accent). Error correction level is `"M"`.
- **Self-signed certificate hint:** A footer note instructs users to accept the self-signed certificate on first visit: "Avanzado → Continuar con {lanIp} (no seguro)".
- **Copyright:** Shows `© 2026 Carlos David Sandoval` with a link to `github.com/dotdeivid`.
- **ID:** Root footer has `id="qr-footer"`.
