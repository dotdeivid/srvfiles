import { Component, type ReactNode, type ErrorInfo } from 'react';
import { log } from '../../lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic error boundary that catches render errors in its subtree.
 * Logs the error via the app's logger and renders a fallback UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void log.error('[ErrorBoundary] uncaught render error', {
      error: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#e2e8f0',
          background: '#0a0a0f',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Algo salió mal</h2>
          <p style={{ color: '#94a3b8', maxWidth: '500px' }}>
            Ocurrió un error inesperado. Intentá recargar la página.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.6rem 1.4rem',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Recargar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
