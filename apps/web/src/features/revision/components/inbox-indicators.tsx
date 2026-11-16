'use client';

import type { RecordStatus } from '@gns/shared';

import { LoadError } from '@/shared/data';
import type { Remote } from '@/shared/data';
import { STATUS_INFO } from '@/shared/records';
import { Icon } from '@/shared/ui';

import type { PlanIndicators } from '../hooks/use-plan-inbox';
import { INDICATOR_STATUSES } from '../model/plan-filters';
import styles from './inbox-indicators.module.css';

const LABELS: Record<RecordStatus, string> = {
  borrador: 'Borradores',
  enviada: 'Pendientes de revisión',
  observaciones: 'Con observaciones',
  revisada: 'Revisadas',
  anulado: 'Anuladas',
};

interface InboxIndicatorsProps {
  remote: Remote<PlanIndicators>;
  active: RecordStatus | undefined;
  onSelect: (status: RecordStatus | null) => void;
}

/** Franja de cifras: cada una filtra la lista por su estado (volver a pulsarla quita el filtro). */
export function InboxIndicators({ remote, active, onSelect }: InboxIndicatorsProps) {
  if (remote.state.status === 'error') {
    return (
      <LoadError
        error={remote.state.error}
        title="No pudimos cargar los indicadores"
        onRetry={remote.reload}
      />
    );
  }
  const counts = remote.state.status === 'ready' ? remote.state.data : null;
  return (
    <ul className={styles.strip} aria-label="Indicadores de revisión">
      {INDICATOR_STATUSES.map((status) => {
        const selected = active === status;
        return (
          <li key={status} className={styles.item}>
            <button
              type="button"
              className={styles.card}
              data-tone={STATUS_INFO[status].tone}
              aria-pressed={selected}
              onClick={() => onSelect(selected ? null : status)}
            >
              <span className={styles.value} aria-busy={counts === null}>
                {counts ? counts[status] : '…'}
              </span>
              <span className={styles.label}>{LABELS[status]}</span>
              {selected ? <Icon name="check" size={16} className={styles.mark} /> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
