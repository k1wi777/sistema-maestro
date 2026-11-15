import { Card, Icon, StepSummary } from '@/shared/ui';

import type { ReviewSummary } from '../../model/review-summary';
import styles from './review-step.module.css';

interface ReviewStepProps {
  summary: ReviewSummary;
  readOnly: boolean;
  number: number;
  onGoToStep: (stepId: string) => void;
  onSubmit: () => void;
}

/** Último paso: resume cada parte con «Editar» y deja enviar cuando lo obligatorio está completo. */
export function ReviewStep({ summary, readOnly, number, onGoToStep, onSubmit }: ReviewStepProps) {
  return (
    <Card title="Revisar y enviar" step={number}>
      {readOnly ? (
        <ul className={styles.list}>
          {summary.items.map((item) => (
            <li key={item.id} className={styles.item}>
              <Icon name={item.complete ? 'check' : 'alerta'} size={16} />
              <div>
                <b>{item.title}</b>
                <span className={styles.detail}>{item.detail}</span>
              </div>
              <button type="button" className={styles.view} onClick={() => onGoToStep(item.id)}>
                Ver
                <span className="sr-only">{`: ${item.title}`}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <StepSummary
          items={summary.items}
          goLabel="Editar"
          onGoToStep={onGoToStep}
          note={
            <>
              Mientras coordinación la revisa no podrás editarla.
              {summary.blockedReason ? (
                <>
                  <br />
                  <strong>{summary.blockedReason}</strong>
                </>
              ) : null}
            </>
          }
          submitLabel="Enviar a coordinación"
          submitDisabled={summary.blockedReason !== null}
          onSubmit={onSubmit}
        />
      )}
    </Card>
  );
}
