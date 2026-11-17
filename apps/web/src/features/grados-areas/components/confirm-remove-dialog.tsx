'use client';

import { useState } from 'react';

import type { ApiError, ApiResult } from '@/shared/api';
import { Button, Dialog, Notice } from '@/shared/ui';

import { removeDecision } from '../model/structure';

export interface RemoveTarget {
  /** «el grupo Kinder 1», «el área Danza». */
  what: string;
  inUse: boolean;
  /** Borra (sin uso) o desactiva (en uso); devuelve el resultado de la API. */
  run: (decision: 'delete' | 'deactivate') => Promise<ApiResult<unknown>>;
}

export function errorText(error: ApiError): string {
  const reasons = 'errors' in error ? (error.errors ?? []) : [];
  return reasons.length > 0
    ? `${error.message}: ${reasons.map((item) => `${item.field} ${item.reason}`).join('; ')}`
    : error.message;
}

/**
 * Confirmación de quitar un elemento del catálogo: «Borrar» solo si nada lo usa; si lo usa, explica
 * que se desactiva y que lo registrado se conserva.
 */
export function ConfirmRemoveDialog({
  target,
  onDone,
  onClose,
}: {
  target: RemoveTarget | null;
  onDone: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decision = target ? removeDecision(target.inUse) : 'delete';

  async function confirm() {
    if (!target) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await target.run(decision);
    setBusy(false);
    if (result.ok) {
      onDone();
    } else {
      setError(errorText(result.error));
    }
  }

  return (
    <Dialog
      open={target !== null}
      title={decision === 'delete' ? 'Borrar' : 'Desactivar'}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void confirm()}>
            {decision === 'delete' ? 'Borrar' : 'Desactivar'}
          </Button>
        </>
      }
    >
      {target ? (
        <>
          <p>
            {decision === 'delete'
              ? `¿Borrar ${target.what}? No tiene registros y no se puede deshacer.`
              : `${target.what.charAt(0).toUpperCase()}${target.what.slice(1)} ya tiene registros, así que no se puede borrar: se desactiva. Lo registrado se conserva y deja de ofrecerse en altas nuevas.`}
          </p>
          {error ? (
            <Notice tone="error" title="No se pudo completar">
              {error}
            </Notice>
          ) : null}
        </>
      ) : null}
    </Dialog>
  );
}
