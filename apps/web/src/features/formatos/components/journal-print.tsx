import { AnnotationStatus, type FieldJournalDay } from '@gns/shared';

import { formatDateTime, formatDayWithYear, formatTime } from '@/shared/format/dates';
import { JOURNAL_STATUS_INFO } from '@/shared/records';
import { BrandMark } from '@/shared/ui';

import { JOURNAL_EVENT_INFO } from '../model/labels';
import { missingText } from '../model/journal-text';
import styles from './journal-print.module.css';

/**
 * Hoja de impresión del F-PA-05 («Exportar PDF»): existe siempre en la página pero solo se ve al
 * imprimir. Lleva la identidad del colegio, el encabezado del formato, la tabla de anotaciones
 * enviadas (sin borradores), quién no aportó y la revisión, sin controles de la interfaz. La API no
 * genera este PDF (decisión del Work Item).
 */
export function JournalPrint({ journal }: { journal: FieldJournalDay }) {
  const sent = journal.annotations.filter(
    (annotation) => annotation.status !== AnnotationStatus.Draft,
  );
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
            <td>{journal.schoolYear}</td>
            <th scope="row">Nivel</th>
            <td>{journal.level.name}</td>
          </tr>
          <tr>
            <th scope="row">Grado</th>
            <td>{journal.grade.name}</td>
            <th scope="row">Grupo</th>
            <td>{journal.group.name}</td>
          </tr>
          <tr>
            <th scope="row">Fecha</th>
            <td>{formatDayWithYear(journal.date)}</td>
            <th scope="row">Director(a) de grupo</th>
            <td>{journal.homeroomTeacher?.fullName ?? '—'}</td>
          </tr>
        </tbody>
      </table>

      <h2 className={styles.heading}>Anotaciones</h2>
      <table className={styles.entries}>
        <thead>
          <tr>
            <th scope="col">Docente</th>
            <th scope="col">Asignatura</th>
            <th scope="col">Tipo de evento</th>
            <th scope="col">Estudiantes</th>
            <th scope="col">Descripción</th>
            <th scope="col">Acciones de mejora</th>
            <th scope="col">Reflexión</th>
            <th scope="col">Hora</th>
          </tr>
        </thead>
        <tbody>
          {sent.length === 0 ? (
            <tr>
              <td colSpan={8}>Sin anotaciones.</td>
            </tr>
          ) : (
            sent.map((annotation) => (
              <tr key={annotation.id}>
                <td>{annotation.teacher.fullName}</td>
                <td>{annotation.area.name}</td>
                <td>{JOURNAL_EVENT_INFO[annotation.eventType].label}</td>
                <td>{annotation.students.join(', ')}</td>
                <td>{annotation.description}</td>
                <td>{annotation.actions ?? ''}</td>
                <td>{annotation.reflection ?? ''}</td>
                <td>{annotation.readyAt ? formatTime(annotation.readyAt) : ''}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {journal.missing.length > 0 ? (
        <p className={styles.comment}>Sin aporte: {missingText(journal.missing)}.</p>
      ) : null}

      <section className={styles.review}>
        <h2 className={styles.heading}>Revisión</h2>
        {journal.signature ? (
          <p className={styles.signature}>
            Revisado por:{' '}
            <b>{`${journal.signature.reviewer.fullName}, ${formatDateTime(journal.signature.date)}`}</b>
          </p>
        ) : (
          <p className={styles.signature}>
            Revisado por: <b>Pendiente de revisión por coordinación</b>
          </p>
        )}
        {journal.generalObservation ? (
          <p className={styles.comment}>Observación general: {journal.generalObservation.text}</p>
        ) : null}
        {journal.status ? (
          <p className={styles.state}>Estado: {JOURNAL_STATUS_INFO[journal.status].label}</p>
        ) : null}
      </section>

      <footer className={styles.footer}>
        {[
          journal.submittedAt
            ? `Enviado a coordinación el ${formatDateTime(journal.submittedAt)}`
            : null,
          'Documento generado desde la Plataforma GNS',
        ]
          .filter(Boolean)
          .join(' · ')}
      </footer>
    </article>
  );
}
