import { VOID_REASON_MAX_LENGTH, VOID_REASON_MIN_LENGTH, voidLessonPlanSchema } from '@gns/shared';
import { useState } from 'react';

import { Button, Dialog, Notice, TextArea } from '@/shared/ui';

interface VoidDialogProps {
  onClose: () => void;
  /** Devuelve el motivo del fallo, o `null` si se anuló. */
  onConfirm: (reason: string) => Promise<string | null>;
}

/** Anular una planeación propia: pide el motivo (queda en la bitácora) y confirma. */
export function VoidDialog({ onClose, onConfirm }: VoidDialogProps) {
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    const parsed = voidLessonPlanSchema.safeParse({ reason });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'El motivo no es válido.');
      return;
    }
    setBusy(true);
    setFailure(null);
    const result = await onConfirm(parsed.data.reason);
    if (result !== null) {
      setBusy(false);
      setFailure(result);
    }
  }

  return (
    <Dialog
      open
      title="Anular planeación"
      description="La planeación queda anulada y no se puede editar; coordinación conserva la constancia."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void handleConfirm()}>
            {busy ? 'Anulando…' : 'Anular planeación'}
          </Button>
        </>
      }
    >
      <TextArea
        label="Motivo"
        required
        minLength={VOID_REASON_MIN_LENGTH}
        maxLength={VOID_REASON_MAX_LENGTH}
        help={`Entre ${VOID_REASON_MIN_LENGTH} y ${VOID_REASON_MAX_LENGTH} caracteres. No incluyas datos de estudiantes.`}
        value={reason}
        error={fieldError ?? undefined}
        onChange={(event) => {
          setReason(event.target.value);
          setFieldError(null);
        }}
      />
      {failure ? <Notice tone="error">{failure}</Notice> : null}
    </Dialog>
  );
}
