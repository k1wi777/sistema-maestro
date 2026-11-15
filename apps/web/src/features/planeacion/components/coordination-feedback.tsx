import { ReviewAction } from '@gns/shared';

import { formatDateTime } from '@/shared/format/dates';
import { Observation } from '@/shared/ui';

import { adjustedFieldsLabel, type CoordinationFeedback } from '../model/coordination-feedback';
import styles from './coordination-feedback.module.css';

/** Comentario de la última decisión de coordinación y los campos que ajustó en ella. */
export function CoordinationFeedbackNotice({ feedback }: { feedback: CoordinationFeedback }) {
  const approved = feedback.decision === ReviewAction.Approved;
  return (
    <Observation
      title={approved ? 'Revisión de coordinación' : 'Observaciones de coordinación'}
      author={feedback.reviewer}
      date={formatDateTime(feedback.date)}
    >
      <p className={styles.text}>
        {feedback.comment ?? (approved ? 'Coordinación aprobó la planeación.' : 'Sin comentario.')}
      </p>
      {feedback.adjustedFields.length > 0 ? (
        <p className={styles.adjusted}>
          <strong>Coordinación ajustó:</strong> {adjustedFieldsLabel(feedback.adjustedFields)}.
        </p>
      ) : null}
    </Observation>
  );
}
