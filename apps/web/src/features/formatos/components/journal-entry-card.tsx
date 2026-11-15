import type { FieldJournalEntry } from '@gns/shared';

import { formatDayWithYear } from '@/shared/format/dates';
import { Button, StatusBadge } from '@/shared/ui';

import { JOURNAL_EVENT_INFO } from '../model/labels';
import styles from './journal.module.css';

interface JournalEntryCardProps {
  entry: FieldJournalEntry;
  /** `true` si coordinación ajustó este registro en su última decisión. */
  adjusted: boolean;
  /** Sin acciones cuando la hoja no se puede editar. */
  onEdit?: () => void;
  onRemove?: () => void;
}

/** Un registro de evento de la hoja: fecha, clase, tipo, estudiantes y los textos que tenga. */
export function JournalEntryCard({ entry, adjusted, onEdit, onRemove }: JournalEntryCardProps) {
  const type = JOURNAL_EVENT_INFO[entry.eventType];
  const label = `${formatDayWithYear(entry.date)}${entry.lesson ? ` · ${entry.lesson}` : ''}`;
  return (
    <article className={styles.entry}>
      <div className={styles.entryTop}>
        <strong className={styles.entryDate}>{formatDayWithYear(entry.date)}</strong>
        {entry.lesson ? <span className={styles.entryLesson}>{entry.lesson}</span> : null}
        <StatusBadge tone={type.tone}>{type.label}</StatusBadge>
        {onEdit || onRemove ? (
          <span className={styles.entryActions}>
            {onEdit ? (
              <Button variant="outline" size="sm" startIcon="lapiz" onClick={onEdit}>
                Editar
                <span className="sr-only">{`: ${label}`}</span>
              </Button>
            ) : null}
            {onRemove ? (
              <Button variant="outline" size="sm" startIcon="anular" onClick={onRemove}>
                Quitar
                <span className="sr-only">{`: ${label}`}</span>
              </Button>
            ) : null}
          </span>
        ) : null}
      </div>
      <p className={styles.entryText}>{entry.description}</p>
      {entry.students.length > 0 ? (
        <p className={styles.detail}>
          <strong>Estudiantes:</strong> {entry.students.join(', ')}
        </p>
      ) : null}
      {entry.actions ? (
        <p className={styles.detail}>
          <strong>Acciones:</strong> {entry.actions}
        </p>
      ) : null}
      {entry.reflection ? (
        <p className={styles.detail}>
          <strong>Reflexión:</strong> {entry.reflection}
        </p>
      ) : null}
      {adjusted ? <p className={styles.adjusted}>Ajustado por coordinación</p> : null}
    </article>
  );
}
