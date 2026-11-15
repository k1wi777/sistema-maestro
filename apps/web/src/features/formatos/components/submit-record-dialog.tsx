'use client';

import { Button, Dialog, Notice } from '@/shared/ui';

interface SubmitRecordDialogProps {
  title: string;
  description: string;
  busy: boolean;
  /** Motivo del fallo del envío, si lo hubo. */
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

/** Confirmación del envío a coordinación: avisa que no se podrá editar mientras la revisa. */
export function SubmitRecordDialog({
  title,
  description,
  busy,
  error,
  onClose,
  onConfirm,
}: SubmitRecordDialogProps) {
  return (
    <Dialog
      open
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button endIcon="enviar" disabled={busy} onClick={onConfirm}>
            {busy ? 'Enviando…' : 'Enviar a coordinación'}
          </Button>
        </>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Dialog>
  );
}
