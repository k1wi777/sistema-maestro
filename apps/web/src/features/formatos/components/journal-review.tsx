import { ReviewAction } from '@gns/shared';

import { formatDateTime } from '@/shared/format/dates';
import { Card, Observation } from '@/shared/ui';

import {
  JOURNAL_PENDING_REVIEW,
  adjustedEntriesLabel,
  type JournalFeedback,
  type JournalReviewLine,
} from '../model/journal-feedback';
import styles from './journal.module.css';

/** Sección «Revisión»: quién revisó y cuándo, el comentario de la decisión y los registros ajustados. */
export function JournalReview({
  line,
  feedback,
}: {
  line: JournalReviewLine;
  feedback: JournalFeedback;
}) {
  if (line.kind === 'text') {
    return (
      <Card title="Revisión" step={3}>
        <p className={styles.signature}>
          {line.text === JOURNAL_PENDING_REVIEW ? (
            <>
              Revisado por: <strong>{line.text}</strong>
            </>
          ) : (
            line.text
          )}
        </p>
      </Card>
    );
  }
  const { decision } = line;
  const approved = decision.decision === ReviewAction.Approved;
  const adjusted = adjustedEntriesLabel(feedback.adjustedEntryIds.length);
  return (
    <Card title="Revisión" step={3}>
      <div className={styles.review}>
        <p className={styles.signature}>
          {approved ? 'Revisado por' : 'Devuelta con observaciones por'}:{' '}
          <strong>{`${decision.reviewer}, ${formatDateTime(decision.date)}`}</strong>
        </p>
        <Observation
          title={approved ? 'Revisión de coordinación' : 'Observaciones de coordinación'}
          author={decision.reviewer}
          date={formatDateTime(decision.date)}
        >
          <p className={styles.reviewNote}>
            {decision.comment ?? (approved ? 'Coordinación aprobó la hoja.' : 'Sin comentario.')}
          </p>
          {adjusted ? (
            <p className={styles.reviewAdjusted}>
              <strong>{adjusted}.</strong>
            </p>
          ) : null}
        </Observation>
      </div>
    </Card>
  );
}
