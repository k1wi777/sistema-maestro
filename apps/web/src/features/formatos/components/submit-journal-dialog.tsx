'use client';

import type { FieldJournalDay } from '@gns/shared';

import { Button, Dialog, Notice } from '@/shared/ui';

import { pendingContributorsText } from '../model/journal-text';

interface SubmitJournalDialogProps {
  journal: FieldJournalDay;
  resubmit: boolean;
  busy: boolean;
  /** Motivo del fallo del envío, si lo hubo. */
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmación del envío a coordinación: nombra a quienes aún no tienen una anotación lista y por
 * qué (en borrador o sin aporte). Los borradores no viajan y quedan para su autor como «No enviada».
 */
export function SubmitJournalDialog({
  journal,
  resubmit,
  busy,
  error,
  onClose,
  onConfirm,
}: SubmitJournalDialogProps) {
  const pending = pendingContributorsText(journal.contributors);
  const pendingCount = journal.contributors.filter((entry) => entry.status !== 'ready').length;
  const description = resubmit
    ? 'Al reenviarlo, coordinación vuelve a revisar el diario y nadie podrá agregar ni editar anotaciones mientras tanto.'
    : pending
      ? `${pending} aún no ${pendingCount === 1 ? 'tiene' : 'tienen'} una anotación lista. Si lo envías ahora, coordinación verá quién no aportó y ya nadie podrá agregar ni editar anotaciones.`
      : 'Todos los docentes del grupo tienen su anotación lista. Al enviarlo, nadie podrá agregar ni editar anotaciones mientras coordinación lo revisa.';
  return (
    <Dialog
      open
      title={resubmit ? 'Reenviar a coordinación' : 'Enviar a coordinación'}
      description={description}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {resubmit ? 'Cancelar' : 'Seguir esperando'}
          </Button>
          <Button endIcon="enviar" disabled={busy} onClick={onConfirm}>
            {busy ? 'Enviando…' : resubmit ? 'Reenviar ahora' : 'Enviar ahora'}
          </Button>
        </>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Dialog>
  );
}
