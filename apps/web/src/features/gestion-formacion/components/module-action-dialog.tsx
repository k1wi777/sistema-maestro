'use client';

import { Button, Dialog } from '@/shared/ui';

import type { Confirmation } from '../model/module-actions';

interface ModuleActionDialogProps {
  confirmation: Confirmation;
  busy: boolean;
  /** Texto del botón mientras se completa la acción. */
  busyLabel?: string;
  /** `primary` para confirmar un cambio que no quita nada. */
  variant?: 'danger' | 'primary';
  onClose: () => void;
  onConfirm: () => void;
}

/** Confirmación de una acción que quita algo: se explica qué ocurre antes de llamar a la API. */
export function ModuleActionDialog({
  confirmation,
  busy,
  busyLabel = 'Quitando…',
  variant = 'danger',
  onClose,
  onConfirm,
}: ModuleActionDialogProps) {
  return (
    <Dialog
      open
      title={confirmation.title}
      description={confirmation.description}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button variant={variant} disabled={busy} onClick={onConfirm}>
            {busy ? busyLabel : confirmation.confirmLabel}
          </Button>
        </>
      }
    />
  );
}
