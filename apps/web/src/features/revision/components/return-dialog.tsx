'use client';

import { Button, Dialog } from '@/shared/ui';

import styles from './return-dialog.module.css';

interface ReturnDialogProps {
  open: boolean;
  noun: string;
  observationCount: number;
  adjustmentCount: number;
  /** Comentario tal como lo recibirá el docente. */
  comment: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Confirmación de «Devolver con observaciones»: resume lo que recibirá el docente. */
export function ReturnDialog({
  open,
  noun,
  observationCount,
  adjustmentCount,
  comment,
  busy,
  onClose,
  onConfirm,
}: ReturnDialogProps) {
  const summary = [
    plural(observationCount, 'observación', 'observaciones'),
    ...(adjustmentCount > 0 ? [plural(adjustmentCount, 'ajuste', 'ajustes')] : []),
  ].join(' y ');
  return (
    <Dialog
      open={open}
      title="Devolver con observaciones"
      description={`Vas a devolver ${noun} con ${summary}. Quien la creó podrá corregirla y reenviarla.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy} onClick={onConfirm}>
            {busy ? 'Devolviendo…' : 'Devolver'}
          </Button>
        </>
      }
    >
      <p className={styles.label}>Así lo leerá el docente</p>
      <p className={styles.comment}>{comment}</p>
    </Dialog>
  );
}
