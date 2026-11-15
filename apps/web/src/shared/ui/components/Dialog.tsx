'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

import { cx } from './cx';
import styles from './Dialog.module.css';

export interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  /** Se llama al cerrar con Escape; la feature decide si pone `open` en falso. */
  onClose: () => void;
  /** Acciones del pie (la principal al final). */
  footer?: ReactNode;
  /** Ancho amplio para formularios largos. */
  wide?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Diálogo modal sobre `<dialog>` nativo: `showModal()` atrapa el foco, vuelve inerte el resto de
 * la página y cierra con Escape. Solo pinta su contenido mientras está abierto, de modo que cada
 * apertura empieza con un formulario limpio.
 */
export function Dialog({
  open,
  title,
  description,
  onClose,
  footer,
  wide,
  className,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      // El foco inicial va al primer campo o, si no hay, a la acción segura del pie (Cancelar):
      // por defecto el navegador lo dejaría en el contenedor con desplazamiento.
      const first =
        dialog.querySelector<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
        ) ?? dialog.querySelector<HTMLElement>('footer button:not([disabled])');
      first?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, wide && styles.wide, className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => {
        // Cerrarlo por código también emite `close`: solo importa si lo cerró el usuario.
        if (open) {
          onClose();
        }
      }}
    >
      {open ? (
        <div className={styles.panel}>
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            ) : null}
          </header>
          <div className={styles.body}>{children}</div>
          {footer ? <footer className={styles.footer}>{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}
