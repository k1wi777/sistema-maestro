import { Button, Dialog } from '@/shared/ui';

interface SubmitDialogProps {
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Confirmación del envío: avisa que no se podrá editar mientras coordinación revisa. */
export function SubmitDialog({ busy, onClose, onConfirm }: SubmitDialogProps) {
  return (
    <Dialog
      open
      title="Enviar a coordinación"
      description="Al enviarla no podrás editar la planeación mientras coordinación la revisa. Si te devuelve observaciones, podrás corregirla y reenviarla."
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
    />
  );
}
