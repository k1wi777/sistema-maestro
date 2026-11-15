import { RecordStatus, ReviewAction, type FieldJournal } from '@gns/shared';

import { formatDateTime, formatDayWithYear } from '@/shared/format/dates';
import { STATUS_INFO } from '@/shared/records';
import { BrandMark } from '@/shared/ui';

import {
  JOURNAL_PENDING_REVIEW,
  adjustedEntriesLabel,
  type JournalFeedback,
  type JournalReviewLine,
} from '../model/journal-feedback';
import { JOURNAL_EVENT_INFO } from '../model/labels';
import styles from './journal-print.module.css';

interface JournalPrintProps {
  journal: FieldJournal;
  levelName: string | null;
  line: JournalReviewLine;
  feedback: JournalFeedback;
}

function ReviewBlock({ line, feedback }: { line: JournalReviewLine; feedback: JournalFeedback }) {
  if (line.kind === 'text') {
    return (
      <p className={styles.signature}>
        {line.text === JOURNAL_PENDING_REVIEW ? (
          <>
            Revisado por: <b>{line.text}</b>
          </>
        ) : (
          line.text
        )}
      </p>
    );
  }
  const { decision } = line;
  const approved = decision.decision === ReviewAction.Approved;
  const adjusted = adjustedEntriesLabel(feedback.adjustedEntryIds.length);
  return (
    <>
      <p className={styles.signature}>
        {approved ? 'Revisado por' : 'Devuelta con observaciones por'}:{' '}
        <b>{`${decision.reviewer}, ${formatDateTime(decision.date)}`}</b>
      </p>
      {decision.comment ? <p className={styles.comment}>{decision.comment}</p> : null}
      {adjusted ? <p className={styles.comment}>{adjusted}.</p> : null}
    </>
  );
}

/**
 * Hoja de impresión del F-PA-05 («Exportar PDF»): existe siempre en la página pero solo se ve al
 * imprimir. Lleva la identidad del colegio, el encabezado del formato, la tabla de registros y la
 * revisión, sin controles de la interfaz. La API no genera este PDF (decisión del Work Item).
 */
export function JournalPrint({ journal, levelName, line, feedback }: JournalPrintProps) {
  return (
    <article className={styles.sheet} aria-hidden="true">
      <header className={styles.header}>
        <BrandMark tagline="Montería · Colombia" />
        <p className={styles.kind}>Diario de campo · Código F-PA-05 · Versión 2</p>
      </header>

      <table className={styles.facts}>
        <tbody>
          <tr>
            <th scope="row">Año lectivo</th>
            <td>{journal.period.schoolYear}</td>
            <th scope="row">Nivel</th>
            <td>{levelName ?? '—'}</td>
          </tr>
          <tr>
            <th scope="row">Grado</th>
            <td>{journal.grade.name}</td>
            <th scope="row">Periodo</th>
            <td>{`Periodo ${journal.period.number}`}</td>
          </tr>
          <tr>
            <th scope="row">Docente</th>
            <td colSpan={3}>{journal.teacher.fullName}</td>
          </tr>
        </tbody>
      </table>

      <h2 className={styles.heading}>Registro de eventos</h2>
      <table className={styles.entries}>
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Clase o actividad</th>
            <th scope="col">Tipo de evento</th>
            <th scope="col">Estudiantes</th>
            <th scope="col">Descripción</th>
            <th scope="col">Acciones de mejora</th>
            <th scope="col">Reflexión</th>
          </tr>
        </thead>
        <tbody>
          {journal.entries.length === 0 ? (
            <tr>
              <td colSpan={7}>Sin registros.</td>
            </tr>
          ) : (
            journal.entries.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDayWithYear(entry.date)}</td>
                <td>{entry.lesson ?? ''}</td>
                <td>{JOURNAL_EVENT_INFO[entry.eventType].label}</td>
                <td>{entry.students.join(', ')}</td>
                <td>{entry.description}</td>
                <td>{entry.actions ?? ''}</td>
                <td>{entry.reflection ?? ''}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <section className={styles.review}>
        <h2 className={styles.heading}>Revisión</h2>
        <ReviewBlock line={line} feedback={feedback} />
        {journal.status === RecordStatus.Reviewed ? null : (
          <p className={styles.state}>Estado: {STATUS_INFO[journal.status].label}</p>
        )}
      </section>

      <footer className={styles.footer}>
        {[
          journal.submittedAt
            ? `Enviada a coordinación el ${formatDateTime(journal.submittedAt)}`
            : null,
          'Documento generado desde la Plataforma GNS',
        ]
          .filter(Boolean)
          .join(' · ')}
      </footer>
    </article>
  );
}
