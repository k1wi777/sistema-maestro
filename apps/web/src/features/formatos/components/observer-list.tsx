'use client';

import { RecordStatus, type ObserverNote } from '@gns/shared';

import { usePagedList, useQueryParams } from '@/shared/data';
import { formatDayWithYear } from '@/shared/format/dates';
import { STATUS_INFO } from '@/shared/records';
import { useSession } from '@/shared/session';
import { ButtonLink, RecordCard, StatusBadge } from '@/shared/ui';

import { listObserverNotes } from '../api/observer-notes';
import { OBSERVER_TYPE_INFO } from '../model/labels';
import { RecordListView, statusFromUrl } from './record-list-view';
import styles from './formats-list.module.css';

const PAGE_SIZE = 20;

function NoteCard({ note }: { note: ObserverNote }) {
  const info = STATUS_INFO[note.status];
  const type = OBSERVER_TYPE_INFO[note.type];
  return (
    <RecordCard
      title={note.studentFirstName}
      headingLevel={2}
      tone={info.tone}
      status={<StatusBadge tone={info.tone}>{info.label}</StatusBadge>}
      meta={[`${note.grade.name} · ${formatDayWithYear(note.date)}`, type.label]}
      actions={
        <ButtonLink
          context={`anotación de ${note.studentFirstName}`}
          href={`/docente/formatos/observador/${note.id}`}
          variant="outline"
          size="sm"
          className={styles.stretched}
        >
          {note.status === RecordStatus.Draft || note.status === RecordStatus.ChangesRequested
            ? 'Continuar'
            : 'Ver'}
        </ButtonLink>
      }
    >
      <p className={styles.excerpt}>{note.description}</p>
      {note.status === RecordStatus.ChangesRequested ? (
        <p className={styles.flag}>Coordinación dejó observaciones</p>
      ) : null}
    </RecordCard>
  );
}

/** «Observador del estudiante»: anotaciones del docente con filtro por estado. */
export function ObserverList() {
  const { state: session } = useSession();
  const teacherId = session.status === 'authenticated' ? session.user.id : undefined;
  const { params, update } = useQueryParams();
  const status = statusFromUrl(params.get('estado'));

  const list = usePagedList<ObserverNote>(
    (page) => listObserverNotes({ teacherId, status, page, pageSize: PAGE_SIZE }),
    JSON.stringify([teacherId, status]),
  );

  if (!teacherId) {
    return null;
  }
  return (
    <RecordListView
      list={list}
      status={status}
      onStatusChange={(value) => update({ estado: value })}
      intro="Registra reconocimientos, avances y situaciones académicas o de convivencia de tus estudiantes. Coordinación las revisa y deja sus observaciones."
      action={
        <ButtonLink href="/docente/formatos/observador/nueva" startIcon="mas">
          Nueva anotación
        </ButtonLink>
      }
      filterLabel="Filtrar anotaciones por estado"
      texts={{
        loading: 'Cargando tus anotaciones…',
        loadError: 'No pudimos cargar tus anotaciones',
        emptyTitle: 'Aún no tienes anotaciones',
        emptyBody: 'Registra la primera con el botón «Nueva anotación».',
        count: (total) => (total === 1 ? '1 anotación' : `${total} anotaciones`),
      }}
      getKey={(note) => note.id}
      renderItem={(note) => <NoteCard note={note} />}
    />
  );
}
