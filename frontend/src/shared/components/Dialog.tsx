import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

interface DialogProps {
  open: boolean;
  /**
   * Si se pasa, Esc y el clic fuera del contenido cierran el diálogo. Sin
   * onClose el diálogo no se puede descartar (transferencia entrante, PIN
   * obligatorio): solo se sale con sus propios botones.
   */
  onClose?: () => void;
  /** false: Esc cierra pero el clic fuera no (formularios que no conviene perder). */
  closeOnBackdrop?: boolean;
  role?: 'dialog' | 'alertdialog';
  labelledBy?: string;
  label?: string;
  describedBy?: string;
  /** Elemento que recibe el foco al abrir; si no, el primero enfocable. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}

/**
 * Diálogo modal sobre `<dialog>.showModal()`: el navegador ya mantiene el foco
 * dentro, deja inerte la página de atrás y lo pone en la capa superior (no
 * hace falta z-index). Esto agrega lo que el nativo no resuelve igual en todos
 * lados: Esc controlado (para poder bloquearlo), clic fuera, foco inicial y
 * devolver el foco a lo que abrió el diálogo.
 */
export function Dialog({
  open,
  onClose,
  closeOnBackdrop = true,
  role = 'dialog',
  labelledBy,
  label,
  describedBy,
  initialFocusRef,
  className,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Los padres suelen pasar funciones inline: guardarlas en refs evita que el
  // efecto se reinicie (y mueva el foco) en cada render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const openRef = useRef(open);
  openRef.current = open;
  const pressStartedOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    initialFocusRef?.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus();
    };
    // initialFocusRef es un ref estable; solo importa al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      className={`dialog ${className ?? ''}`}
      role={role === 'alertdialog' ? 'alertdialog' : undefined}
      aria-labelledby={labelledBy}
      aria-label={label}
      aria-describedby={describedBy}
      // Cancelar la tecla evita el cierre nativo; así un diálogo sin onClose
      // no se cierra con Esc (Chrome lo fuerza si solo se cancela el evento
      // "cancel" varias veces seguidas).
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        onCloseRef.current?.();
      }}
      onCancel={(e) => e.preventDefault()}
      // Si igual se cerró por fuera de React, volver a abrirlo mientras siga abierto.
      onClose={() => {
        const dialog = ref.current;
        if (openRef.current && dialog && !dialog.open) dialog.showModal();
      }}
      // Clic fuera: el fondo y el margen del <dialog> son el propio elemento.
      // Se exige que el clic también haya empezado ahí, para que seleccionar
      // texto y soltar fuera no cierre.
      onPointerDown={(e) => { pressStartedOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        if (e.target !== e.currentTarget || !pressStartedOnBackdrop.current) return;
        if (closeOnBackdrop) onCloseRef.current?.();
      }}
    >
      {children}
    </dialog>
  );
}
