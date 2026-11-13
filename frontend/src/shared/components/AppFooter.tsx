/** Pie con el autor. El QR para conectar otro dispositivo vive en ConnectDialog. */
export function AppFooter() {
  return (
    <footer className="app-footer" id="app-footer">
      <p className="app-footer__copyright">
        © 2026 Carlos David Sandoval ·{' '}
        <a href="https://github.com/dotdeivid" target="_blank" rel="noopener noreferrer">
          github.com/dotdeivid
        </a>
      </p>
    </footer>
  );
}
