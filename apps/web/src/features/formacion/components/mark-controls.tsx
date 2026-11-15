'use client';

import { useState } from 'react';

import type { ApiError } from '@/shared/api';
import { Button, Notice, StatusBadge } from '@/shared/ui';

import styles from './media.module.css';

/** Fallo de una acción (por defecto, guardar un avance), junto a la acción, con la opción de reintentar. */
export function MarkError({
  error,
  busy,
  onRetry,
  title = 'No pudimos guardar tu avance',
}: {
  error: ApiError;
  busy: boolean;
  onRetry: () => void;
  title?: string;
}) {
  return (
    <Notice tone="error" title={title}>
      <p>{error.message}</p>
      <p>
        <Button variant="outline" size="sm" disabled={busy} onClick={onRetry}>
          Reintentar
        </Button>
      </p>
    </Notice>
  );
}

/** Botón de marca («Marcar como visto», «Marcar como revisada») y su estado ya cumplido. */
export function MarkControls({
  viewed,
  label,
  doneLabel,
  onMark,
}: {
  viewed: boolean;
  label: string;
  doneLabel: string;
  onMark: () => Promise<ApiError | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function mark() {
    setBusy(true);
    setError(null);
    setError(await onMark());
    setBusy(false);
  }

  return (
    <>
      <div className={styles.actions}>
        {viewed ? (
          <StatusBadge tone="success">{doneLabel}</StatusBadge>
        ) : (
          <Button variant="secondary" startIcon="check" disabled={busy} onClick={() => void mark()}>
            {busy ? 'Guardando…' : label}
          </Button>
        )}
      </div>
      {error ? <MarkError error={error} busy={busy} onRetry={() => void mark()} /> : null}
    </>
  );
}
