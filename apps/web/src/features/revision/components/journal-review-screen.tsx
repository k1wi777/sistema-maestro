'use client';

import type { FieldJournal, Review } from '@gns/shared';

import type { ApiError } from '@/shared/api';
import { LoadError, Loading } from '@/shared/data';
import { formatDateTime, formatDayWithYear } from '@/shared/format/dates';
import { JOURNAL_EVENT_INFO, STATUS_INFO } from '@/shared/records';
import { ButtonLink, Card, Notice, PageContainer, PageHeader, StatusBadge } from '@/shared/ui';

import { JOURNAL_FORMAT, useFormatReview, useFormatReviewData } from '../hooks/use-format-review';
import { FormatReviewPanel } from './format-review-panel';
import styles from './format-review.module.css';

const BACK_HREF = '/coordinacion/formatos?tipo=diario';

function NotFound({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  if (error.statusCode === 404) {
    return (
      <Notice tone="warning" title="No encontramos esta hoja">
        Puede que ya no exista o que el enlace esté incompleto.{' '}
        <ButtonLink href={BACK_HREF} variant="outline" size="sm">
          Volver a Formatos
        </ButtonLink>
      </Notice>
    );
  }
  return <LoadError error={error} onRetry={onRetry} />;
}

function JournalReview({
  journal,
  reviews,
  refresh,
}: {
  journal: FieldJournal;
  reviews: Review[];
  refresh: () => Promise<ApiError | null>;
}) {
  const review = useFormatReview({ format: JOURNAL_FORMAT, record: journal, reviews, refresh });
  const info = STATUS_INFO[journal.status];
  const title = `Diario de campo · ${journal.grade.name}`;

  return (
    <PageContainer>
      <div className={styles.back}>
        <ButtonLink href={BACK_HREF} variant="outline" size="sm" startIcon="volver">
          Formatos
        </ButtonLink>
      </div>
      <PageHeader
        context="Diario de campo (F-PA-05)"
        title={title}
        description={`${journal.teacher.fullName} · Periodo ${journal.period.number} · ${journal.period.schoolYear}`}
        actions={<StatusBadge tone={info.tone}>{info.label}</StatusBadge>}
      />
      <div className={styles.layout}>
        <div className={styles.content}>
          <Card title="Encabezado del formato">
            <dl className={styles.facts}>
              <div>
                <dt>Año lectivo</dt>
                <dd>{journal.period.schoolYear}</dd>
              </div>
              <div>
                <dt>Grado</dt>
                <dd>{journal.grade.name}</dd>
              </div>
              <div>
                <dt>Periodo</dt>
                <dd>{`Periodo ${journal.period.number}`}</dd>
              </div>
              <div>
                <dt>Docente</dt>
                <dd>{journal.teacher.fullName}</dd>
              </div>
              <div>
                <dt>Enviada</dt>
                <dd>{journal.submittedAt ? formatDateTime(journal.submittedAt) : '—'}</dd>
              </div>
            </dl>
          </Card>
          <Card title={`Registros (${journal.entries.length})`}>
            {journal.entries.length === 0 ? (
              <p className={styles.muted}>La hoja no tiene registros.</p>
            ) : (
              <ul className={styles.entries}>
                {journal.entries.map((entry) => {
                  const type = JOURNAL_EVENT_INFO[entry.eventType];
                  return (
                    <li key={entry.id} className={styles.entry}>
                      <div className={styles.entryTop}>
                        <strong className={styles.entryDate}>
                          {formatDayWithYear(entry.date)}
                        </strong>
                        {entry.lesson ? <span className={styles.muted}>{entry.lesson}</span> : null}
                        <StatusBadge tone={type.tone}>{type.label}</StatusBadge>
                      </div>
                      <p className={styles.text}>{entry.description}</p>
                      {entry.students.length > 0 ? (
                        <p className={styles.text}>
                          <strong>Estudiantes (nombre de pila):</strong> {entry.students.join(', ')}
                        </p>
                      ) : null}
                      {entry.actions ? (
                        <p className={styles.text}>
                          <strong>Acciones:</strong> {entry.actions}
                        </p>
                      ) : null}
                      {entry.reflection ? (
                        <p className={styles.text}>
                          <strong>Reflexión:</strong> {entry.reflection}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
        <FormatReviewPanel
          review={review}
          status={journal.status}
          teacher={journal.teacher.fullName}
          noun="hoja"
          voidTitle="Anular hoja"
          backHref={BACK_HREF}
        />
      </div>
    </PageContainer>
  );
}

/** Revisión de una hoja del diario de campo (`/coordinacion/formatos/diario/[id]`). */
export function JournalReviewScreen({ id }: { id: string }) {
  const remote = useFormatReviewData(JOURNAL_FORMAT, id, 'journal-review');
  if (remote.state.status === 'loading') {
    return (
      <PageContainer>
        <Loading>Cargando la hoja…</Loading>
      </PageContainer>
    );
  }
  if (remote.state.status === 'error') {
    return (
      <PageContainer>
        <NotFound error={remote.state.error} onRetry={remote.reload} />
      </PageContainer>
    );
  }
  return (
    <JournalReview
      key={id}
      journal={remote.state.data.record}
      reviews={remote.state.data.reviews}
      refresh={remote.refresh}
    />
  );
}
