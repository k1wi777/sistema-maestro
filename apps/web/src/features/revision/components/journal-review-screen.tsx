'use client';

import { JournalHistoryKind, type FieldJournal, type JournalAnnotation } from '@gns/shared';

import type { ApiError } from '@/shared/api';
import { LoadError, Loading } from '@/shared/data';
import { formatDateTime, formatTime, formatWeekdayDate } from '@/shared/format/dates';
import { ANNOTATION_STATUS_INFO, JOURNAL_STATUS_INFO } from '@/shared/records';
import {
  Button,
  ButtonLink,
  Card,
  Notice,
  Observation,
  PageContainer,
  PageHeader,
  StatusBadge,
  TextArea,
} from '@/shared/ui';

import { useJournalReview, useJournalReviewData } from '../hooks/use-journal-review';
import { observationCountLabel, queuePosition } from '../model/journal-review';
import { JOURNAL_INBOX_PATH } from '../model/paths';
import styles from './format-review.module.css';
import historyStyles from './review-history.module.css';

const BACK_HREF = JOURNAL_INBOX_PATH;

const HISTORY_TEXT: Record<string, (actor: string, detail: string | null) => string> = {
  [JournalHistoryKind.Opened]: (actor) => `${actor} abrió el diario`,
  [JournalHistoryKind.Ready]: (actor, detail) =>
    `${actor} marcó su anotación como lista${detail ? ` (${detail})` : ''}`,
  [JournalHistoryKind.Submitted]: (actor, detail) =>
    `${actor} lo envió a coordinación${detail ? ` (${detail})` : ''}`,
  [JournalHistoryKind.Resubmitted]: (actor, detail) =>
    `${actor} lo reenvió a coordinación${detail ? ` (${detail})` : ''}`,
  [JournalHistoryKind.Returned]: (actor, detail) =>
    `${actor} lo devolvió con observaciones${detail ? ` (${detail})` : ''}`,
  [JournalHistoryKind.Approved]: (actor) => `${actor} lo aprobó`,
  [JournalHistoryKind.Voided]: (actor) => `${actor} lo anuló`,
};

function NotFound({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  if (error.statusCode === 404 || error.statusCode === 403) {
    return (
      <Notice tone="warning" title="No encontramos este diario">
        Puede que no sea de un grado que coordinas, que aún no se haya enviado o que el enlace esté
        incompleto.{' '}
        <ButtonLink href={BACK_HREF} variant="outline" size="sm">
          Volver a Diarios de campo
        </ButtonLink>
      </Notice>
    );
  }
  return <LoadError error={error} onRetry={onRetry} />;
}

function AnnotationSection({
  annotation,
  review,
}: {
  annotation: JournalAnnotation;
  review: ReturnType<typeof useJournalReview>;
}) {
  const status = ANNOTATION_STATUS_INFO[annotation.status];
  const observing = review.open.has(annotation.id);
  const label = `${annotation.area.name} · ${annotation.teacher.fullName}`;
  return (
    <li className={styles.entry}>
      <div className={styles.entryTop}>
        <strong className={styles.entryDate}>
          {annotation.readyAt ? `${label} · ${formatTime(annotation.readyAt)}` : label}
        </strong>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>
      <p className={styles.text}>
        <strong>Descripción de eventos:</strong> {annotation.description}
      </p>
      {annotation.observation ? (
        <Observation
          title={`Observación para ${annotation.teacher.fullName}`}
          author={annotation.observation.reviewer.fullName}
          date={formatDateTime(annotation.observation.date)}
        >
          {annotation.observation.text}
        </Observation>
      ) : null}
      {review.canDecide ? (
        <>
          {observing ? (
            <TextArea
              label={`Tu observación para ${annotation.teacher.fullName}`}
              rows={3}
              value={review.observations[annotation.id] ?? ''}
              onChange={(event) => review.observe(annotation.id, event.target.value)}
            />
          ) : null}
          <div>
            <Button
              variant="outline"
              size="sm"
              startIcon="comentario"
              context={`anotación de ${label}`}
              onClick={() => review.toggle(annotation.id)}
            >
              {observing ? 'Quitar observación' : 'Observar'}
            </Button>
          </div>
        </>
      ) : null}
    </li>
  );
}

function JournalReviewView({
  journal,
  queue,
  refresh,
}: {
  journal: FieldJournal;
  queue: string[];
  refresh: () => Promise<ApiError | null>;
}) {
  const review = useJournalReview({ journal, queue, refresh });
  const info = JOURNAL_STATUS_INFO[journal.status];
  const position = queuePosition(queue, journal.id);
  const sent = journal.annotations.filter((annotation) => annotation.status !== 'borrador');
  const reasonBlocked =
    !journal.viewer.canReview && journal.status !== 'enviado'
      ? `Este diario está ${info.label.toLowerCase()}: solo se revisan los enviados.`
      : !journal.viewer.canReview
        ? 'Participaste en este diario o lo enviaste: otra persona de coordinación debe revisarlo.'
        : null;
  const pending = journal.missing.map((entry) =>
    entry.areas.length > 0
      ? `${entry.teacher.fullName} (${entry.areas.join(', ')})`
      : entry.teacher.fullName,
  );

  return (
    <PageContainer>
      <div className={styles.back}>
        <ButtonLink href={BACK_HREF} variant="outline" size="sm" startIcon="volver">
          Diarios de campo
        </ButtonLink>
      </div>
      <PageHeader
        context="Diarios de campo"
        title={`${journal.group.name} · ${formatWeekdayDate(journal.date)}`}
        description={[
          journal.homeroomTeacher
            ? `Director(a) de grupo: ${journal.homeroomTeacher.fullName}`
            : null,
          journal.submittedAt ? `Enviado el ${formatDateTime(journal.submittedAt)}` : null,
          `${journal.readyCount} de ${journal.expectedCount} docentes aportaron`,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <div className={styles.entryTop}>
            <StatusBadge tone={info.tone}>{info.shortLabel}</StatusBadge>
            {position ? (
              <span
                className={styles.muted}
              >{`${position.index} de ${position.total} pendientes`}</span>
            ) : null}
          </div>
        }
      />
      <div className={styles.layout}>
        <div className={styles.content}>
          <Card title="Encabezado del formato">
            <dl className={styles.facts}>
              <div>
                <dt>Código</dt>
                <dd>F-PA-05 · Versión 2</dd>
              </div>
              <div>
                <dt>Año lectivo y nivel</dt>
                <dd>{`${journal.schoolYear} · ${journal.level.name}`}</dd>
              </div>
              <div>
                <dt>Grado, grupo y fecha</dt>
                <dd>{`${journal.grade.name} · ${journal.group.name} · ${formatWeekdayDate(journal.date)}`}</dd>
              </div>
              <div>
                <dt>Director(a) de grupo</dt>
                <dd>{journal.homeroomTeacher?.fullName ?? 'Sin director(a) asignado'}</dd>
              </div>
            </dl>
          </Card>
          {pending.length > 0 ? (
            <Notice tone="warning" title="Sin aporte">
              {pending.join(', ')}.
            </Notice>
          ) : null}
          <Card title={`Anotaciones (${sent.length})`}>
            {sent.length === 0 ? (
              <p className={styles.muted}>El diario no tiene anotaciones enviadas.</p>
            ) : (
              <ul className={styles.entries}>
                {sent.map((annotation) => (
                  <AnnotationSection key={annotation.id} annotation={annotation} review={review} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className={styles.panel} aria-label="Revisión de coordinación">
          <Card title="Tu revisión">
            <div className={styles.body}>
              {review.notice ? (
                <Notice tone={review.notice.tone}>
                  <p className={styles.noticeText}>{review.notice.text}</p>
                </Notice>
              ) : null}
              {reasonBlocked ? <Notice tone="info">{reasonBlocked}</Notice> : null}
              {journal.signature ? (
                <p className={styles.signature}>
                  Revisado por:{' '}
                  <strong>{`${journal.signature.reviewer.fullName}, ${formatDateTime(journal.signature.date)}`}</strong>
                </p>
              ) : null}
              {journal.generalObservation ? (
                <Observation
                  title="Observación general"
                  author={journal.generalObservation.reviewer.fullName}
                  date={formatDateTime(journal.generalObservation.date)}
                >
                  {journal.generalObservation.text}
                </Observation>
              ) : null}
              {review.canDecide ? (
                <>
                  <p className={styles.counter}>
                    {review.observationCount === 0
                      ? 'Aún no has observado ninguna anotación.'
                      : observationCountLabel(review.observationCount)}
                  </p>
                  <TextArea
                    label="Observación general"
                    rows={4}
                    value={review.general}
                    help="Opcional al aprobar; úsala o escribe observaciones por anotación para devolver."
                    onChange={(event) => review.setGeneral(event.target.value)}
                  />
                  <div className={styles.decisions}>
                    <Button
                      variant="secondary"
                      disabled={review.busy !== null}
                      onClick={() => void review.returnWithObservations()}
                    >
                      {review.busy === 'return' ? 'Devolviendo…' : 'Devolver con observaciones'}
                    </Button>
                    <Button
                      startIcon="check"
                      disabled={review.busy !== null}
                      onClick={() => void review.approve()}
                    >
                      {review.busy === 'approve' ? 'Aprobando…' : 'Aprobar y pasar al siguiente'}
                    </Button>
                  </div>
                </>
              ) : null}
              <section aria-labelledby="historial-diario" className={styles.history}>
                <h3 id="historial-diario" className={styles.historyTitle}>
                  Historial
                </h3>
                <ol className={historyStyles.list}>
                  {[...journal.history].reverse().map((item, index) => (
                    <li
                      key={`${item.kind}-${item.at.toISOString()}-${index}`}
                      className={historyStyles.item}
                    >
                      <time className={historyStyles.date} dateTime={item.at.toISOString()}>
                        {formatDateTime(item.at)}
                      </time>
                      <p className={historyStyles.headline}>
                        {(HISTORY_TEXT[item.kind] ?? (() => item.kind))(
                          item.actor?.fullName ?? 'Alguien',
                          item.detail,
                        )}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

/** Revisión de un diario de campo completo (`/coordinacion/formatos/diario/[id]`). */
export function JournalReviewScreen({ id }: { id: string }) {
  const remote = useJournalReviewData(id);
  if (remote.state.status === 'loading') {
    return (
      <PageContainer>
        <Loading>Cargando el diario…</Loading>
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
    <JournalReviewView
      key={id}
      journal={remote.state.data.journal}
      queue={remote.state.data.queue}
      refresh={remote.refresh}
    />
  );
}
