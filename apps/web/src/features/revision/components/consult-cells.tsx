import type { ReactNode } from 'react';

import { reviewerHint, type GradeCoordinator } from '@/shared/records';
import { StatusBadge } from '@/shared/ui';

import styles from './consult-cells.module.css';

/** «Solo consulta» con texto (no solo color) para el registro que la persona no revisa. */
export function ConsultBadge() {
  return <StatusBadge tone="neutral">Solo consulta</StatusBadge>;
}

/** Celda de estado: el estado del registro y, si es ajeno, «Solo consulta». */
export function StatusWithConsult({ badge, consult }: { badge: ReactNode; consult: boolean }) {
  return (
    <span className={styles.stack}>
      {badge}
      {consult ? <ConsultBadge /> : null}
    </span>
  );
}

/** «Revisa: Elena Ravassa» o «Sin coordinadora». */
export function ReviewerText({ coordinator }: { coordinator: GradeCoordinator | null }) {
  return <span className={coordinator ? undefined : styles.none}>{reviewerHint(coordinator)}</span>;
}
