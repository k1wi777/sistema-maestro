import { RecordStatus, type ObserverNote } from '@gns/shared';
import type { ReactNode } from 'react';

import { LoadError, Loading, type PagedList } from '@/shared/data';
import { formatDayWithYear } from '@/shared/format/dates';
import {
  OBSERVER_TYPE_INFO,
  STATUS_INFO,
  STATUS_ORDER,
  canReviewGrade,
  coordinatorOfGrade,
  type CatalogGradeScope,
  type ReviewUser,
} from '@/shared/records';
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
import { ReviewerText, StatusWithConsult } from './consult-cells';
import styles from './inbox-list.module.css';

const ALL = 'todas';

const STATUS_OPTIONS: SegmentedOption<string>[] = [
  { value: ALL, label: 'Todos' },
  ...STATUS_ORDER.map((status) => ({ value: status, label: STATUS_INFO[status].filterLabel })),
];

export function statusFromUrl(value: string | null): RecordStatus | undefined {
  return STATUS_ORDER.find((status) => status === value);
}

interface NoteColumnsContext {
  /** Ruta de la bandeja de observadores de la vista (`<vista>/formatos/observador`). */
  path: string;
  /** Query para volver a la bandeja con el mismo alcance (`vista=colegio`). */
  query: string;
  user: ReviewUser | null;
  grades: readonly CatalogGradeScope[];
  /** Muestra la columna «Revisa»: coordinación en «Todo el colegio» y administración. */
  showReviewer: boolean;
}

export function noteColumns({
  path,
  query,
  user,
  grades,
  showReviewer,
}: NoteColumnsContext): DataTableColumn<ObserverNote>[] {
  const coordinatorOf = (note: ObserverNote) => coordinatorOfGrade(grades, note.grade.id);
  const consults = (note: ObserverNote) => !canReviewGrade(user, coordinatorOf(note));
  return [
    { key: 'teacher', header: 'Docente', render: (note) => note.teacher.fullName },
    {
      key: 'student',
      header: 'Estudiante · grado',
      render: (note) => `${note.studentFirstName} · ${note.grade.name}`,
    },
    ...(showReviewer
      ? [
          {
            key: 'reviewer',
            header: 'Revisa',
            render: (note: ObserverNote) => <ReviewerText coordinator={coordinatorOf(note)} />,
          },
        ]
      : []),
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
    {
      key: 'status',
      header: 'Estado',
      render: (note) => (
        <StatusWithConsult
          consult={consults(note)}
          badge={
            <StatusBadge tone={STATUS_INFO[note.status].tone}>
              {shortStatusLabel(note.status)}
            </StatusBadge>
          }
        />
      ),
    },
    {
      key: 'action',
      header: 'Acción',
      render: (note) => {
        const review = !consults(note) && note.status === RecordStatus.Submitted;
        return (
          <ButtonLink
            context={`anotación de ${note.studentFirstName}`}
            href={`${path}/${note.id}${query ? `?${query}` : ''}`}
            variant={review ? 'primary' : 'outline'}
            size="sm"
          >
            {review ? 'Revisar' : consults(note) ? 'Ver' : 'Abrir'}
          </ButtonLink>
        );
      },
    },
  ];
}

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
  /** Selector de alcance («Mis grados» / «Todo el colegio») y filtros propios, sobre el de estado. */
  toolbar?: ReactNode;
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
  toolbar,
}: InboxListProps<T>) {
  return (
    <div className={styles.list}>
      {intro}
      {toolbar}
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
