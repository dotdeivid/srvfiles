/**
 * Señal que se aborta tras `ms` o cuando se aborta `parent`. Implementada a
 * mano porque AbortSignal.any/timeout no existen en WebViews algo viejos.
 */
export function timeoutSignal(ms: number, parent?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), ms);
  const stop = () => clearTimeout(timer);
  controller.signal.addEventListener('abort', stop, { once: true });
  if (parent) {
    if (parent.aborted) controller.abort(parent.reason);
    else parent.addEventListener('abort', () => controller.abort(parent.reason), { once: true });
  }
  return controller.signal;
}
