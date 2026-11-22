import { useState } from 'react';

import { Button, Dialog, Notice } from '@/shared/ui';

interface DiscardDraftDialogProps {
  /** Qué se borra y por qué se puede descartar (el texto del tablero para cada registro). */
  description: string;
  onClose: () => void;
  /** Devuelve el motivo del fallo, o `null` si se descartó. */
  onConfirm: () => Promise<string | null>;
}

/**
 * Descartar un borrador propio que nunca se envió: es un borrado real, sin motivo (la bitácora
 * registra el descarte sin su contenido). Si la API rechaza, el diálogo sigue abierto con el mensaje.
 */
export function DiscardDraftDialog({ description, onClose, onConfirm }: DiscardDraftDialogProps) {
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    setFailure(null);
    const result = await onConfirm();
    if (result !== null) {
      setBusy(false);
      setFailure(result);
    }
  }

  return (
    <Dialog
      open
      title="Descartar borrador"
      description={description}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void handleConfirm()}>
            {busy ? 'Descartando…' : 'Descartar borrador'}
          </Button>
        </>
      }
    >
      {failure ? <Notice tone="error">{failure}</Notice> : null}
    </Dialog>
  );
}
