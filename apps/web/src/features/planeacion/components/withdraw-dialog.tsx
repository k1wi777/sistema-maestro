import type { SharedActivity } from '@gns/shared';
import { useState } from 'react';

import { Button, Dialog, Notice } from '@/shared/ui';

import { withdrawSharedActivity } from '../api/shared-activities';

interface WithdrawDialogProps {
  activity: SharedActivity;
  onClose: () => void;
  onWithdrawn: () => void;
}

/** Retirar una actividad propia del repositorio: nada se borra físicamente y queda constancia. */
export function WithdrawDialog({ activity, onClose, onWithdrawn }: WithdrawDialogProps) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setFailure(null);
    const result = await withdrawSharedActivity(activity.id);
    if (result.ok) {
      onWithdrawn();
      return;
    }
    setBusy(false);
    setFailure(result.error.message);
  }

  return (
    <Dialog
      open
      title="Retirar actividad"
      description="Se retira del repositorio para todos; queda constancia en la bitácora."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void handleConfirm()}>
            {busy ? 'Retirando…' : 'Retirar actividad'}
          </Button>
        </>
      }
    >
      <p>
        Vas a retirar «<b>{activity.title}</b>».
      </p>
      {failure ? <Notice tone="error">{failure}</Notice> : null}
    </Dialog>
  );
}
