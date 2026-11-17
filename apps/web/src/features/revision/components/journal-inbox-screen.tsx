'use client';

import { JournalStatus, type FieldJournalSummary, type JournalReviewScope } from '@gns/shared';

import { LoadError, Loading, useQueryParams } from '@/shared/data';
import { formatShortDate, formatShortWeekday } from '@/shared/format/dates';
import { JOURNAL_STATUS_INFO, journalStatusFromUrl } from '@/shared/records';
import {
  Button,
  ButtonLink,
  DataTable,
  Notice,
  PageContainer,
  PageHeader,
  Select,
  StatusBadge,
  TextInput,
  type DataTableColumn,
} from '@/shared/ui';

import { useJournalInbox, useJournalScope } from '../hooks/use-format-inbox';
import { JOURNAL_INBOX_PATH, FORMATS_HUB_PATH } from '../model/paths';
import styles from './inbox-list.module.css';
import filterStyles from './journal-inbox.module.css';

const COLUMNS: DataTableColumn<FieldJournalSummary>[] = [
  { key: 'group', header: 'Grupo', render: (journal) => journal.group.name },
  { key: 'date', header: 'Fecha', render: (journal) => formatShortWeekday(journal.date) },
  {
    key: 'director',
    header: 'Director(a)',
    render: (journal) => journal.homeroomTeacher?.fullName ?? '—',
  },
  {
    key: 'contributions',
    header: 'Aportes',
    render: (journal) => `${journal.readyCount} de ${journal.expectedCount}`,
  },
  {
    key: 'submitted',
    header: 'Enviado',
    render: (journal) => (journal.submittedAt ? formatShortDate(journal.submittedAt) : '—'),
  },
  {
    key: 'status',
    header: 'Estado',
    render: (journal) => (
      <StatusBadge tone={JOURNAL_STATUS_INFO[journal.status].tone}>
        {JOURNAL_STATUS_INFO[journal.status].shortLabel}
      </StatusBadge>
    ),
  },
  {
    key: 'action',
    header: 'Acción',
    render: (journal) => {
      const pending = journal.status === JournalStatus.Submitted;
      return (
        <ButtonLink
          context={`diario de ${journal.group.name} del ${journal.date}`}
          href={`${JOURNAL_INBOX_PATH}/${journal.id}`}
          variant={pending ? 'primary' : 'outline'}
          size="sm"
        >
          {pending ? 'Revisar' : 'Abrir'}
        </ButtonLink>
      );
    },
  },
];

/** Estados que ofrece el filtro: la coordinadora recibe el diario desde el primer envío. */
const COORDINATOR_STATUSES = [
  JournalStatus.Submitted,
  JournalStatus.ChangesRequested,
  JournalStatus.Reviewed,
] as const;
const ADMIN_STATUSES = [
  JournalStatus.InProgress,
  ...COORDINATOR_STATUSES,
  JournalStatus.Voided,
] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function ScopeNotice({ scope }: { scope: JournalReviewScope }) {
  if (scope.unrestricted) {
    return null;
  }
  if (scope.grades.length === 0) {
    return (
      <Notice tone="info" title="Sin grados asignados">
        Aún no tienes grados asignados. Pídele a administración que te los asigne en Grados y áreas.
      </Notice>
    );
  }
  return (
    <Notice tone="info">
      Ves los diarios de tus grados: {scope.grades.map((grade) => grade.name).join(', ')}.
    </Notice>
  );
}

/** Bandeja de diarios de campo de coordinación (`/coordinacion/formatos/diario`). */
export function JournalInboxScreen() {
  const { params, update } = useQueryParams();
  const scope = useJournalScope();
  const status = journalStatusFromUrl(params.get('estado'));
  const scopeData = scope.state.status === 'ready' ? scope.state.data : null;
  const gradeParam = params.get('grado');
  const gradeId = scopeData?.grades.some((grade) => grade.id === gradeParam) ? gradeParam : null;
  const groupParam = params.get('grupo');
  const groups = (scopeData?.groups ?? []).filter((group) => !gradeId || group.gradeId === gradeId);
  const groupId = groups.some((group) => group.id === groupParam) ? groupParam : null;
  const from = DATE_PATTERN.test(params.get('desde') ?? '') ? params.get('desde') : null;
  const to = DATE_PATTERN.test(params.get('hasta') ?? '') ? params.get('hasta') : null;
  const list = useJournalInbox({
    status,
    gradeId: gradeId ?? undefined,
    groupId: groupId ?? undefined,
    from: from ?? undefined,
    to: to ?? undefined,
  });
  const statuses = scopeData?.unrestricted ? ADMIN_STATUSES : COORDINATOR_STATUSES;
  const noScope = scopeData && !scopeData.unrestricted && scopeData.grades.length === 0;

  const figure = (label: string, value: number, filter: JournalStatus) => (
    <Button
      key={filter}
      variant={status === filter ? 'primary' : 'outline'}
      aria-pressed={status === filter}
      className={filterStyles.figure}
      onClick={() => update({ estado: status === filter ? null : filter })}
    >
      <span className={filterStyles.figureValue}>{value}</span>
      <span>{label}</span>
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader
        context="Coordinación académica"
        title="Diarios de campo"
        description="Revisa el diario de cada grupo y día con las anotaciones de todos sus docentes: devuélvelo con observaciones o apruébalo con tu firma."
        actions={
          <ButtonLink href={FORMATS_HUB_PATH} variant="outline" startIcon="volver">
            Formatos
          </ButtonLink>
        }
      />
      <div className={styles.list}>
        {scope.state.status === 'error' ? (
          <LoadError
            error={scope.state.error}
            title="No pudimos cargar tu alcance"
            onRetry={scope.reload}
          />
        ) : null}
        {scopeData ? <ScopeNotice scope={scopeData} /> : null}
        {scopeData ? (
          <div className={filterStyles.figures} role="group" aria-label="Diarios por estado">
            {figure('Pendientes de revisión', scopeData.counts.submitted, JournalStatus.Submitted)}
            {figure(
              'Con observaciones',
              scopeData.counts.changesRequested,
              JournalStatus.ChangesRequested,
            )}
            {figure('Revisados', scopeData.counts.reviewed, JournalStatus.Reviewed)}
          </div>
        ) : null}

        {noScope ? null : (
          <>
            <form
              className={filterStyles.filters}
              aria-label="Filtros de los diarios"
              onSubmit={(event) => event.preventDefault()}
            >
              <Select
                label="Estado"
                placeholder="Todos los estados"
                options={statuses.map((value) => ({
                  value,
                  label: JOURNAL_STATUS_INFO[value].shortLabel,
                }))}
                value={status ?? ''}
                onChange={(event) => update({ estado: event.target.value || null })}
              />
              <Select
                label="Grado"
                placeholder="Todos mis grados"
                options={(scopeData?.grades ?? []).map((grade) => ({
                  value: grade.id,
                  label: grade.name,
                }))}
                value={gradeId ?? ''}
                onChange={(event) => update({ grado: event.target.value || null, grupo: null })}
              />
              <Select
                label="Grupo"
                placeholder="Todos"
                options={groups.map((group) => ({ value: group.id, label: group.name }))}
                value={groupId ?? ''}
                onChange={(event) => update({ grupo: event.target.value || null })}
              />
              <TextInput
                label="Desde"
                type="date"
                value={from ?? ''}
                onChange={(event) => update({ desde: event.target.value || null })}
              />
              <TextInput
                label="Hasta"
                type="date"
                value={to ?? ''}
                onChange={(event) => update({ hasta: event.target.value || null })}
              />
            </form>

            {list.status === 'loading' ? <Loading>Cargando los diarios de campo…</Loading> : null}
            {list.status === 'error' && list.error ? (
              <LoadError
                error={list.error}
                title="No pudimos cargar los diarios de campo"
                onRetry={list.reload}
              />
            ) : null}
            {list.status === 'ready' ? (
              <>
                <p className={styles.count} role="status">
                  {list.totalItems === 1 ? '1 diario' : `${list.totalItems} diarios`}
                </p>
                <DataTable
                  caption="Diarios de los grupos"
                  showCaption
                  columns={COLUMNS}
                  rows={list.items}
                  getRowKey={(journal) => journal.id}
                  emptyMessage="Ningún diario cumple estos filtros."
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
          </>
        )}
      </div>
    </PageContainer>
  );
}
