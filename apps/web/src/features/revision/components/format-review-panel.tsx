'use client';

import {
  canTransition,
  RecordActor,
  RecordOperation,
  REVIEW_COMMENT_MAX_LENGTH,
  type RecordStatus,
} from '@gns/shared';
import { useState } from 'react';

import { VoidRecordDialog } from '@/shared/records';
import { Button, ButtonLink, Card, Notice, TextArea } from '@/shared/ui';

import type { FormatReview } from '../hooks/use-format-review';
import { ReturnDialog } from './return-dialog';
import { ReviewHistory } from './review-history';
import styles from './format-review.module.css';

interface FormatReviewPanelProps {
  review: FormatReview;
  status: RecordStatus;
  teacher: string;
  noun: 'hoja' | 'anotación';
  /** Texto de los diálogos de anulación. */
  voidTitle: string;
  /** Vuelve a la bandeja del formato (diarios de campo u observadores). */
  backHref: string;
  /** Nombre de esa bandeja, para el texto del enlace de vuelta. */
  backLabel: string;
}

/**
 * Panel de revisión de un diario o una anotación: observaciones de coordinación, firma, devolver,
 * marcar revisada, historial con quién firmó cada decisión y anular.
 */
export function FormatReviewPanel({
  review,
  status,
  teacher,
  noun,
  voidTitle,
  backHref,
  backLabel,
}: FormatReviewPanelProps) {
  const [returning, setReturning] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const { canDecide, busy, notice } = review;
  const article = noun === 'hoja' ? 'la hoja' : 'la anotación';

  return (
    <aside
      className={styles.panel}
      aria-label={review.canReview ? 'Revisión de coordinación' : 'Historial'}
    >
      <Card title={review.canReview ? 'Revisión de coordinación' : 'Historial'}>
        <div className={styles.body}>
          {notice ? (
            <Notice tone={notice.tone}>
              <p className={styles.noticeText}>{notice.text}</p>
              {notice.retryable ? (
                <Button variant="outline" size="sm" onClick={() => void review.retryLast()}>
                  Reintentar
                </Button>
              ) : null}
              {notice.tone === 'success' ? (
                <ButtonLink href={backHref} variant="outline" size="sm" startIcon="volver">
                  Volver a {backLabel}
                </ButtonLink>
              ) : null}
            </Notice>
          ) : null}
          {review.consultText ? (
            <Notice tone="info" title="Solo consulta">
              {review.consultText}
            </Notice>
          ) : null}
          {!canDecide && review.blockedReason ? (
            <Notice tone="info">{review.blockedReason}</Notice>
          ) : null}

          {canDecide ? (
            <>
              <TextArea
                label="Observaciones de coordinación"
                rows={5}
                value={review.comment}
                help={`Obligatorias para devolver; opcionales al marcar revisada (máximo ${REVIEW_COMMENT_MAX_LENGTH} caracteres).`}
                onChange={(event) => review.setComment(event.target.value)}
              />
              <p className={styles.counter} data-over={review.excess > 0}>
                {review.excess > 0
                  ? `Excede el máximo en ${review.excess} caracteres.`
                  : `${review.comment.trim().length} de ${REVIEW_COMMENT_MAX_LENGTH} caracteres.`}
              </p>
              <p className={styles.signature}>
                Quedará firmado como: <strong>{review.userName}</strong>
              </p>
              <div className={styles.decisions}>
                <Button
                  variant="secondary"
                  disabled={busy !== null || review.excess > 0}
                  onClick={() => {
                    if (review.canReturn()) {
                      setReturning(true);
                    }
                  }}
                >
                  Devolver con observaciones
                </Button>
                <Button
                  startIcon="check"
                  disabled={busy !== null || review.excess > 0}
                  onClick={() => void review.approve()}
                >
                  {busy === 'approve' ? 'Marcando…' : 'Marcar revisada'}
                </Button>
              </div>
            </>
          ) : null}

          <section aria-labelledby="historial-formato" className={styles.history}>
            <h3 id="historial-formato" className={styles.historyTitle}>
              Historial de revisión
            </h3>
            <ReviewHistory lines={review.history} teacher={teacher} signed />
          </section>

          {review.canReview && canTransition(RecordOperation.Void, RecordActor.Reviewer, status) ? (
            <Button
              variant="void"
              size="sm"
              startIcon="anular"
              disabled={busy !== null}
              onClick={() => setVoiding(true)}
            >
              {voidTitle}
            </Button>
          ) : null}
        </div>
      </Card>

      <ReturnDialog
        open={returning}
        noun={article}
        observationCount={1}
        adjustmentCount={0}
        comment={review.comment.trim()}
        busy={busy === 'return'}
        onClose={() => setReturning(false)}
        onConfirm={() => {
          setReturning(false);
          void review.confirmReturn();
        }}
      />
      {voiding ? (
        <VoidRecordDialog
          title={voidTitle}
          description="El registro queda anulado y en solo lectura. Nada se borra: el motivo queda en la bitácora."
          confirmLabel={voidTitle}
          onClose={() => setVoiding(false)}
          onConfirm={async (reason) => {
            const failure = await review.voidWithReason(reason);
            if (failure === null) {
              setVoiding(false);
            }
            return failure;
          }}
        />
      ) : null}
    </aside>
  );
}
