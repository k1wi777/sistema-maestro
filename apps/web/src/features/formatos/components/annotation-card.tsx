import type { JournalAnnotation } from '@gns/shared';
import type { ReactNode } from 'react';

import { formatDateTime, formatTime } from '@/shared/format/dates';
import { ANNOTATION_STATUS_INFO } from '@/shared/records';
import { Observation, StatusBadge } from '@/shared/ui';

import { JOURNAL_EVENT_INFO } from '../model/labels';
import styles from './journal.module.css';

interface AnnotationCardProps {
  annotation: JournalAnnotation;
  /** Con el nombre del docente (vista de los demás docentes y del director(a)). */
  showTeacher?: boolean;
  actions?: ReactNode;
}

/** Una anotación del diario con sus datos y, si la hay, la observación de coordinación. */
export function AnnotationCard({ annotation, showTeacher = false, actions }: AnnotationCardProps) {
  const type = JOURNAL_EVENT_INFO[annotation.eventType];
  const status = ANNOTATION_STATUS_INFO[annotation.status];
  const unsent = annotation.isMine && annotation.status === 'borrador' && annotation.sent;
  return (
    <article className={styles.entry} aria-label={`Anotación de ${annotation.area.name}`}>
      <div className={styles.entryTop}>
        {showTeacher ? (
          <strong className={styles.entryDate}>{annotation.teacher.fullName}</strong>
        ) : null}
        <span className={styles.entryLesson}>{annotation.area.name}</span>
        <StatusBadge tone={type.tone}>{type.label}</StatusBadge>
        <StatusBadge tone={status.tone}>
          {annotation.readyAt && annotation.status !== 'borrador'
            ? `${status.label} · ${formatTime(annotation.readyAt)}`
            : status.label}
        </StatusBadge>
        {unsent ? <StatusBadge tone="neutral">No enviada</StatusBadge> : null}
        {actions ? <div className={styles.entryActions}>{actions}</div> : null}
      </div>
      <p className={styles.entryText}>{annotation.description}</p>
      {annotation.students.length > 0 ? (
        <p className={styles.detail}>
          <strong>Estudiantes:</strong> {annotation.students.join(', ')}
        </p>
      ) : null}
      {annotation.actions ? (
        <p className={styles.detail}>
          <strong>Acciones:</strong> {annotation.actions}
        </p>
      ) : null}
      {annotation.reflection ? (
        <p className={styles.detail}>
          <strong>Reflexión:</strong> {annotation.reflection}
        </p>
      ) : null}
      {annotation.observation ? (
        <Observation
          title={
            annotation.isMine
              ? 'Observación para ti'
              : `Observación para ${annotation.teacher.fullName}`
          }
          author={annotation.observation.reviewer.fullName}
          date={formatDateTime(annotation.observation.date)}
        >
          {annotation.observation.text}
        </Observation>
      ) : null}
    </article>
  );
}
