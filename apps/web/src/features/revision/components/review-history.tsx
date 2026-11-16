import { formatDateTime } from '@/shared/format/dates';

import type { HistoryLine } from '../model/history';
import styles from './review-history.module.css';

function headline(line: HistoryLine, teacher: string): string {
  switch (line.kind) {
    case 'submitted':
      return `${teacher} la envió a coordinación`;
    case 'returned':
      return `${line.reviewer ?? 'Coordinación'} devolvió con observaciones`;
    case 'approved':
      return `${line.reviewer ?? 'Coordinación'} aprobó`;
    case 'adjusted':
      return `${line.reviewer ?? 'Coordinación'} ajustó el contenido`;
  }
}

interface ReviewHistoryProps {
  lines: readonly HistoryLine[];
  /** Nombre del docente, que protagoniza el envío. */
  teacher: string;
  /** Texto de «Firmado por …» en cada decisión (diarios y anotaciones). */
  signed?: boolean;
}

/** Historial de revisión, del más reciente al más antiguo: envío, devoluciones, aprobaciones y ajustes. */
export function ReviewHistory({ lines, teacher, signed = false }: ReviewHistoryProps) {
  if (lines.length === 0) {
    return <p className={styles.empty}>Aún no hay actividad de revisión.</p>;
  }
  return (
    <ol className={styles.list}>
      {lines.map((line) => (
        <li key={line.id} className={styles.item} data-kind={line.kind}>
          <time className={styles.date} dateTime={line.date.toISOString()}>
            {formatDateTime(line.date)}
          </time>
          <p className={styles.headline}>{headline(line, teacher)}</p>
          {signed && line.reviewer && line.kind !== 'submitted' ? (
            <p className={styles.detail}>{`Firmado por ${line.reviewer}`}</p>
          ) : null}
          {line.adjusted.length > 0 ? (
            <p className={styles.detail}>{`Campos ajustados: ${line.adjusted.join(', ')}.`}</p>
          ) : null}
          {line.comment ? <p className={styles.comment}>{line.comment}</p> : null}
        </li>
      ))}
    </ol>
  );
}
