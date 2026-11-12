import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Tipografías empaquetadas con la app: funcionan sin internet (uso típico en
// LAN) y no revelan la IP a terceros.
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import './styles/index.css';
import App from './App';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import { log } from './lib/logger';

void log.info('[main] SrvFiles frontend starting');

// Errores fuera de React (promesas sin catch, errores globales) → log.
window.addEventListener('unhandledrejection', (e) => {
  void log.error('[main] unhandled promise rejection', { reason: String(e.reason) });
});
window.addEventListener('error', (e) => {
  void log.error('[main] uncaught error', { message: e.message, source: e.filename, line: e.lineno });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
