'use client';

import {
  ObserverNoteType,
  RecordStatus,
  type FieldJournalSummary,
  type ObserverNote,
} from '@gns/shared';
import type { ReactNode } from 'react';

import { LoadError, Loading, useQueryParams, type PagedList } from '@/shared/data';
import { formatDayWithYear, formatShortDate } from '@/shared/format/dates';
import { OBSERVER_TYPE_INFO, STATUS_INFO, STATUS_ORDER } from '@/shared/records';
import {
  Button,
  ButtonLink,
  DataTable,
  Notice,
  PageContainer,
  PageHeader,
  SegmentedFilter,
  StatusBadge,
  Tabs,
  type DataTableColumn,
  type SegmentedOption,
} from '@/shared/ui';

import { useJournalInbox, useNoteInbox, usePendingCounts } from '../hooks/use-format-inbox';
import { shortStatusLabel } from '../model/status-label';
import styles from './formats-inbox-screen.module.css';

const JOURNAL_TAB = 'diario';
const OBSERVER_TAB = 'observador';
const ALL = 'todas';

const STATUS_OPTIONS: SegmentedOption<string>[] = [
  { value: ALL, label: 'Todos' },
  ...STATUS_ORDER.map((status) => ({ value: status, label: STATUS_INFO[status].filterLabel })),
];

function statusFromUrl(value: string | null): RecordStatus | undefined {
  return STATUS_ORDER.find((status) => status === value);
}

function StatusCell({ status }: { status: RecordStatus }) {
  return <StatusBadge tone={STATUS_INFO[status].tone}>{shortStatusLabel(status)}</StatusBadge>;
}

const JOURNAL_COLUMNS: DataTableColumn<FieldJournalSummary>[] = [
  { key: 'teacher', header: 'Docente', render: (journal) => journal.teacher.fullName },
  { key: 'grade', header: 'Grado', render: (journal) => journal.grade.name },
  {
    key: 'period',
    header: 'Periodo',
    render: (journal) => (
      <>
        <span aria-hidden="true">{`P${journal.period.number}`}</span>
        <span className="sr-only">{`Periodo ${journal.period.number}`}</span>
      </>
    ),
  },
  { key: 'entries', header: 'Registros', numeric: true, render: (journal) => journal.entryCount },
  {
    key: 'submitted',
    header: 'Enviada',
    render: (journal) => (journal.submittedAt ? formatShortDate(journal.submittedAt) : '—'),
  },
  { key: 'status', header: 'Estado', render: (journal) => <StatusCell status={journal.status} /> },
  {
    key: 'action',
    header: 'Acción',
    render: (journal) => (
      <ButtonLink
        href={`/coordinacion/formatos/diario/${journal.id}`}
        variant={journal.status === RecordStatus.Submitted ? 'primary' : 'outline'}
        size="sm"
      >
        {journal.status === RecordStatus.Submitted ? 'Revisar' : 'Abrir'}
        <span className="sr-only">{`: diario de ${journal.teacher.fullName}, ${journal.grade.name}`}</span>
      </ButtonLink>
    ),
  },
];

const NOTE_COLUMNS: DataTableColumn<ObserverNote>[] = [
  { key: 'teacher', header: 'Docente', render: (note) => note.teacher.fullName },
  {
    key: 'student',
    header: 'Estudiante · grado',
    render: (note) => `${note.studentFirstName} · ${note.grade.name}`,
  },
  {
    key: 'type',
    header: 'Tipo',
    render: (note) => (
      <StatusBadge tone={OBSERVER_TYPE_INFO[note.type].tone}>
        {OBSERVER_TYPE_INFO[note.type].label}
      </StatusBadge>
    ),
  },
  { key: 'date', header: 'Fecha', render: (note) => formatDayWithYear(note.date) },
  { key: 'status', header: 'Estado', render: (note) => <StatusCell status={note.status} /> },
  {
    key: 'action',
    header: 'Acción',
    render: (note) => (
      <ButtonLink
        href={`/coordinacion/formatos/observador/${note.id}`}
        variant={note.status === RecordStatus.Submitted ? 'primary' : 'outline'}
        size="sm"
      >
        {note.status === RecordStatus.Submitted ? 'Revisar' : 'Abrir'}
        <span className="sr-only">{`: anotación de ${note.studentFirstName}`}</span>
      </ButtonLink>
    ),
  },
];

interface InboxListProps<T> {
  list: PagedList<T>;
  caption: string;
  columns: DataTableColumn<T>[];
  getRowKey: (row: T) => string;
  status: RecordStatus | undefined;
  onStatusChange: (status: string | null) => void;
  loading: string;
  loadError: string;
  count: (total: number) => string;
  /** Aviso sobre el orden de la lista. */
  intro?: ReactNode;
}

/** Filtro por estado y tabla con «Cargar más» comunes a las dos pestañas. */
function InboxList<T>({
  list,
  caption,
  columns,
  getRowKey,
  status,
  onStatusChange,
  loading,
  loadError,
  count,
  intro,
}: InboxListProps<T>) {
  return (
    <div className={styles.list}>
      {intro}
      <SegmentedFilter
        label="Filtrar por estado"
        options={STATUS_OPTIONS}
        value={status ?? ALL}
        onChange={(value) => onStatusChange(value === ALL ? null : value)}
      />
      {list.status === 'loading' ? <Loading>{loading}</Loading> : null}
      {list.status === 'error' && list.error ? (
        <LoadError error={list.error} title={loadError} onRetry={list.reload} />
      ) : null}
      {list.status === 'ready' ? (
        <>
          <p className={styles.count} role="status">
            {count(list.totalItems)}
          </p>
          <DataTable
            caption={caption}
            columns={columns}
            rows={list.items}
            getRowKey={getRowKey}
            emptyMessage={
              status
                ? 'Ningún registro cumple este filtro. Elige otro estado para ver más.'
                : 'Aún no hay registros.'
            }
          />
          {list.error ? <LoadError error={list.error} onRetry={list.loadMore} /> : null}
          {list.hasMore ? (
            <div className={styles.more}>
              <Button variant="outline" disabled={list.loadingMore} onClick={list.loadMore}>
                {list.loadingMore ? 'Cargando…' : 'Cargar más'}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function JournalInbox({
  status,
  onStatusChange,
}: {
  status: RecordStatus | undefined;
  onStatusChange: (status: string | null) => void;
}) {
  const list = useJournalInbox(status);
  return (
    <InboxList
      list={list}
      caption="Diarios de campo de los docentes"
      columns={JOURNAL_COLUMNS}
      getRowKey={(journal) => journal.id}
      status={status}
      onStatusChange={onStatusChange}
      loading="Cargando los diarios de campo…"
      loadError="No pudimos cargar los diarios de campo"
      count={(total) => (total === 1 ? '1 hoja' : `${total} hojas`)}
    />
  );
}

function ObserverInbox({
  status,
  onStatusChange,
}: {
  status: RecordStatus | undefined;
  onStatusChange: (status: string | null) => void;
}) {
  const list = useNoteInbox(status);
  const priority = list.items.some(
    (note) => note.type === ObserverNoteType.TypeIII || note.type === ObserverNoteType.TypeII,
  );
  return (
    <InboxList
      list={list}
      caption="Anotaciones del observador de los docentes"
      columns={NOTE_COLUMNS}
      getRowKey={(note) => note.id}
      status={status}
      onStatusChange={onStatusChange}
      loading="Cargando las anotaciones…"
      loadError="No pudimos cargar las anotaciones"
      count={(total) => (total === 1 ? '1 anotación' : `${total} anotaciones`)}
      intro={
        <Notice tone={priority ? 'warning' : 'info'}>
          Las situaciones de convivencia Tipo III y Tipo II aparecen primero. Las anotaciones son
          confidenciales: solo llevan el nombre de pila del estudiante.
        </Notice>
      }
    />
  );
}

/** Formatos de coordinación: diarios de campo y observador, en pestañas con sus pendientes. */
export function FormatsInboxScreen() {
  const { params, update } = useQueryParams();
  const tab = params.get('tipo') === OBSERVER_TAB ? OBSERVER_TAB : JOURNAL_TAB;
  const status = statusFromUrl(params.get('estado'));
  const pending = usePendingCounts();
  const counts = pending.state.status === 'ready' ? pending.state.data : null;
  const label = (name: string, count: number | undefined) =>
    count === undefined ? name : `${name} (${count})`;

  return (
    <PageContainer>
      <PageHeader
        context="Coordinación académica"
        title="Formatos"
        description="Revisa los diarios de campo (F-PA-05) y las anotaciones del observador: devuélvelos con observaciones o apruébalos con tu firma. Entre paréntesis, lo que está pendiente de revisión en cada pestaña."
      />
      {pending.state.status === 'error' ? (
        <LoadError
          error={pending.state.error}
          title="No pudimos contar los pendientes"
          onRetry={pending.reload}
        />
      ) : null}
      <Tabs
        label="Formatos"
        value={tab}
        // El filtro por estado de una pestaña no se arrastra a la otra.
        onChange={(id) => update({ tipo: id === JOURNAL_TAB ? null : id, estado: null })}
        tabs={[
          {
            id: JOURNAL_TAB,
            label: label('Diario de campo', counts?.journals),
            content: (
              <JournalInbox status={status} onStatusChange={(value) => update({ estado: value })} />
            ),
          },
          {
            id: OBSERVER_TAB,
            label: label('Observador del estudiante', counts?.notes),
            content: (
              <ObserverInbox
                status={status}
                onStatusChange={(value) => update({ estado: value })}
              />
            ),
          },
        ]}
      />
    </PageContainer>
  );
}
