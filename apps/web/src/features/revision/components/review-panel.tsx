'use client';

import { RecordStatus, REVIEW_COMMENT_MAX_LENGTH, type LessonPlan } from '@gns/shared';
import { useState } from 'react';

import { VoidRecordDialog } from '@/shared/records';
import { Button, Card, Notice, StatusBadge, TextArea } from '@/shared/ui';

import type { PlanReview } from '../hooks/use-plan-review';
import { blockAnchor } from './review-block';
import { ReturnDialog } from './return-dialog';
import { ReviewHistory } from './review-history';
import styles from './review-panel.module.css';

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

/** Panel «Tu revisión»: observaciones por bloque, general, decisiones, historial y «Anular». */
export function ReviewPanel({ plan, review }: { plan: LessonPlan; review: PlanReview }) {
  const [returning, setReturning] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const { state, canDecide, busy, notice } = review;
  const observed = review.blocks.filter((block) => (state.observations[block.key] ?? '').trim());
  const deciding = busy === 'approve' || busy === 'return';

  return (
    <aside className={styles.panel} aria-label={review.canReview ? 'Tu revisión' : 'Historial'}>
      <Card title={review.canReview ? 'Tu revisión' : 'Historial'}>
        <div className={styles.body}>
          {review.canReview ? (
            <div className={styles.counts}>
              <StatusBadge tone={review.observationCount > 0 ? 'warning' : 'neutral'}>
                {plural(review.observationCount, 'observación', 'observaciones')}
              </StatusBadge>
              <StatusBadge tone={review.adjustmentCount > 0 ? 'info' : 'neutral'}>
                {plural(review.adjustmentCount, 'ajuste', 'ajustes')}
              </StatusBadge>
            </div>
          ) : null}

          {notice ? (
            <Notice tone={notice.tone}>
              <p className={styles.noticeText}>{notice.text}</p>
              {notice.retryable ? (
                <Button variant="outline" size="sm" onClick={() => void review.retryLast()}>
                  Reintentar
                </Button>
              ) : null}
            </Notice>
          ) : null}
          {review.lostComment ? (
            <Notice tone="info" title="Lo que habías escrito">
              <p className={styles.noticeText}>{review.lostComment}</p>
            </Notice>
          ) : null}
          {observed.length > 0 ? (
            <ul className={styles.observations} aria-label="Observaciones por bloque">
              {observed.map((block) => (
                <li key={block.key}>
                  <a className={styles.link} href={`#${blockAnchor(block.key)}`}>
                    <strong>{block.label}</strong>
                    <span className={styles.excerpt}>{state.observations[block.key]}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          {canDecide ? (
            <>
              <TextArea
                label="Observación general"
                rows={4}
                value={state.general}
                help="Opcional al aprobar; úsala también para lo que no es de un bloque."
                onChange={(event) => review.setGeneral(event.target.value)}
              />
              <p
                className={styles.counter}
                data-over={review.excess > 0}
                role={review.excess > 0 ? 'alert' : undefined}
              >
                {review.excess > 0
                  ? `Excede el máximo en ${review.excess} caracteres (${review.comment.length} de ${REVIEW_COMMENT_MAX_LENGTH}).`
                  : `${review.comment.length} de ${REVIEW_COMMENT_MAX_LENGTH} caracteres en el comentario.`}
              </p>
              <div className={styles.decisions}>
                <Button
                  endIcon="siguiente"
                  disabled={busy !== null || review.excess > 0}
                  onClick={() => void review.approveAndNext()}
                >
                  {busy === 'approve' ? 'Aprobando…' : 'Aprobar y pasar a la siguiente'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy !== null || review.excess > 0}
                  onClick={() => (review.comment ? setReturning(true) : review.warnNoObservation())}
                >
                  Devolver con observaciones
                </Button>
                <Button
                  variant="outline"
                  startIcon="guardar"
                  disabled={busy !== null}
                  onClick={review.saveDraft}
                >
                  Guardar ajustes sin decidir
                </Button>
              </div>
            </>
          ) : null}

          <section aria-labelledby="historial-revision" className={styles.history}>
            <h3 id="historial-revision" className={styles.historyTitle}>
              Historial
            </h3>
            <ReviewHistory lines={review.history} teacher={plan.teacher.fullName} />
          </section>

          {review.canReview && plan.status !== RecordStatus.Voided ? (
            <Button
              variant="void"
              size="sm"
              startIcon="anular"
              disabled={busy !== null}
              onClick={() => setVoiding(true)}
            >
              Anular planeación
            </Button>
          ) : null}
        </div>
      </Card>

      <ReturnDialog
        open={returning}
        noun="la planeación"
        observationCount={review.observationCount}
        adjustmentCount={review.adjustmentCount}
        comment={review.comment}
        busy={deciding}
        onClose={() => setReturning(false)}
        onConfirm={() => {
          setReturning(false);
          void review.confirmReturn();
        }}
      />
      {voiding ? (
        <VoidRecordDialog
          title="Anular planeación"
          description="La planeación queda anulada y en solo lectura. Nada se borra: el motivo queda en la bitácora."
          confirmLabel="Anular planeación"
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
