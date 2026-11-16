'use client';

import { ObserverNoteType, type ObserverNote, type Review } from '@gns/shared';
import type { ReactNode } from 'react';

import type { ApiError } from '@/shared/api';
import { LoadError, Loading } from '@/shared/data';
import { formatDayWithYear } from '@/shared/format/dates';
import { OBSERVER_TYPE_INFO, STATUS_INFO } from '@/shared/records';
import { ButtonLink, Card, Notice, PageContainer, PageHeader, StatusBadge } from '@/shared/ui';

import { NOTE_FORMAT, useFormatReview, useFormatReviewData } from '../hooks/use-format-review';
import { FormatReviewPanel } from './format-review-panel';
import styles from './format-review.module.css';

const BACK_HREF = '/coordinacion/formatos?tipo=observador';

function NotFound({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  if (error.statusCode === 404) {
    return (
      <Notice tone="warning" title="No encontramos esta anotación">
        Puede que ya no exista o que el enlace esté incompleto.{' '}
        <ButtonLink href={BACK_HREF} variant="outline" size="sm">
          Volver a Formatos
        </ButtonLink>
      </Notice>
    );
  }
  return <LoadError error={error} onRetry={onRetry} />;
}

function Fact({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? styles.wide : undefined}>
      <dt>{label}</dt>
      <dd>{children || '—'}</dd>
    </div>
  );
}

function NoteReview({
  note,
  reviews,
  refresh,
}: {
  note: ObserverNote;
  reviews: Review[];
  refresh: () => Promise<ApiError | null>;
}) {
  const review = useFormatReview({ format: NOTE_FORMAT, record: note, reviews, refresh });
  const info = STATUS_INFO[note.status];
  const type = OBSERVER_TYPE_INFO[note.type];
  const convivencia =
    note.type === ObserverNoteType.TypeII || note.type === ObserverNoteType.TypeIII;

  return (
    <PageContainer>
      <div className={styles.back}>
        <ButtonLink href={BACK_HREF} variant="outline" size="sm" startIcon="volver">
          Formatos
        </ButtonLink>
      </div>
      <PageHeader
        context="Observador del estudiante"
        title={`Anotación de ${note.studentFirstName}`}
        description={`${note.teacher.fullName} · ${note.grade.name} · ${formatDayWithYear(note.date)}`}
        actions={
          <>
            <StatusBadge tone={type.tone}>{type.label}</StatusBadge>
            <StatusBadge tone={info.tone}>{info.label}</StatusBadge>
          </>
        }
      />
      <div className={styles.notices}>
        <Notice tone="info" title="Información confidencial">
          Solo la ven su autor y coordinación. De los estudiantes se registra únicamente el nombre
          de pila: no copies ni compartas esta anotación fuera de la plataforma.
        </Notice>
        {convivencia ? (
          <Notice tone="warning" title="Situación de convivencia Tipo II o III">
            Debe seguirse la ruta de atención del Manual de Convivencia (Ley 1620 de 2013).
          </Notice>
        ) : null}
      </div>
      <div className={styles.layout}>
        <div className={styles.content}>
          <Card title="Anotación">
            <dl className={styles.facts}>
              <Fact label="Grado">{note.grade.name}</Fact>
              <Fact label="Estudiante (nombre de pila)">{note.studentFirstName}</Fact>
              <Fact label="Fecha">{formatDayWithYear(note.date)}</Fact>
              <Fact label="Tipo de anotación">{type.label}</Fact>
              <Fact label="Se informó a la familia">{note.familyInformed ? 'Sí' : 'No'}</Fact>
              <Fact label="Descripción de la situación" wide>
                {note.description}
              </Fact>
              <Fact label="Descargos o versión del estudiante" wide>
                {note.studentVersion}
              </Fact>
              <Fact label="Acciones pedagógicas y compromisos" wide>
                {note.actions}
              </Fact>
              <Fact label="Seguimiento" wide>
                {note.followUp}
              </Fact>
            </dl>
          </Card>
        </div>
        <FormatReviewPanel
          review={review}
          status={note.status}
          teacher={note.teacher.fullName}
          noun="anotación"
          voidTitle="Anular anotación"
          backHref={BACK_HREF}
        />
      </div>
    </PageContainer>
  );
}

/** Revisión de una anotación del observador (`/coordinacion/formatos/observador/[id]`). */
export function ObserverReviewScreen({ id }: { id: string }) {
  const remote = useFormatReviewData(NOTE_FORMAT, id, 'note-review');
  if (remote.state.status === 'loading') {
    return (
      <PageContainer>
        <Loading>Cargando la anotación…</Loading>
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
    <NoteReview
      key={id}
      note={remote.state.data.record}
      reviews={remote.state.data.reviews}
      refresh={remote.refresh}
    />
  );
}
