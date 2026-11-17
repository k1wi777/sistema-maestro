import { RecordStatus, type ObserverNote } from '@gns/shared';
import type { ReactNode } from 'react';

import { LoadError, Loading, type PagedList } from '@/shared/data';
import { formatDayWithYear } from '@/shared/format/dates';
import { OBSERVER_TYPE_INFO, STATUS_INFO, STATUS_ORDER } from '@/shared/records';
import {
  Button,
  ButtonLink,
  DataTable,
  SegmentedFilter,
  StatusBadge,
  type DataTableColumn,
  type SegmentedOption,
} from '@/shared/ui';

import { shortStatusLabel } from '../model/status-label';
import { OBSERVER_INBOX_PATH } from '../model/paths';
import styles from './inbox-list.module.css';

const ALL = 'todas';

const STATUS_OPTIONS: SegmentedOption<string>[] = [
  { value: ALL, label: 'Todos' },
  ...STATUS_ORDER.map((status) => ({ value: status, label: STATUS_INFO[status].filterLabel })),
];

export function statusFromUrl(value: string | null): RecordStatus | undefined {
  return STATUS_ORDER.find((status) => status === value);
}

function StatusCell({ status }: { status: RecordStatus }) {
  return <StatusBadge tone={STATUS_INFO[status].tone}>{shortStatusLabel(status)}</StatusBadge>;
}

export const NOTE_COLUMNS: DataTableColumn<ObserverNote>[] = [
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
        context={`anotación de ${note.studentFirstName}`}
        href={`${OBSERVER_INBOX_PATH}/${note.id}`}
        variant={note.status === RecordStatus.Submitted ? 'primary' : 'outline'}
        size="sm"
      >
        {note.status === RecordStatus.Submitted ? 'Revisar' : 'Abrir'}
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

/** Filtro por estado y tabla con «Cargar más» comunes a las bandejas de diarios y observadores. */
export function InboxList<T>({
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
