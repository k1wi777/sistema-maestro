'use client';

import { JournalStatus, type FieldJournalSummary } from '@gns/shared';
import { useMemo } from 'react';

import { LoadError, Loading, useQueryParams } from '@/shared/data';
import { formatShortDate, formatShortWeekday } from '@/shared/format/dates';
import {
  JOURNAL_STATUS_INFO,
  canReviewGrade,
  coordinatorOfGrade,
  journalStatusFromUrl,
  myGrades,
  type CatalogGradeScope,
  type ReviewUser,
} from '@/shared/records';
import { useView } from '@/shared/shell';
import {
  Button,
  ButtonLink,
  Card,
  DataTable,
  FilterBar,
  Notice,
  PageContainer,
  PageHeader,
  Select,
  StatStrip,
  StatusBadge,
  TextInput,
  type DataTableColumn,
} from '@/shared/ui';

import { useJournalInbox, useJournalScope } from '../hooks/use-format-inbox';
import { useInboxViewer } from '../hooks/use-inbox-viewer';
import { useInboxCatalogs } from '../hooks/use-plan-inbox';
import { useRevisionPaths } from '../hooks/use-revision-paths';
import { coordinatorFilter, noGradesMessage, resolveScope, vistaParam } from '../model/inbox-scope';
import { ReviewerText, StatusWithConsult } from './consult-cells';
import { InboxScopeFilter } from './inbox-scope-filter';
import styles from './inbox-list.module.css';

interface ColumnContext {
  path: string;
  query: string;
  user: ReviewUser | null;
  grades: readonly CatalogGradeScope[];
  showReviewer: boolean;
}

function journalColumns({
  path,
  query,
  user,
  grades,
  showReviewer,
}: ColumnContext): DataTableColumn<FieldJournalSummary>[] {
  const coordinatorOf = (journal: FieldJournalSummary) =>
    coordinatorOfGrade(grades, journal.grade.id);
  const consults = (journal: FieldJournalSummary) => !canReviewGrade(user, coordinatorOf(journal));
  return [
    { key: 'group', header: 'Grupo', render: (journal) => journal.group.name },
    { key: 'date', header: 'Fecha', render: (journal) => formatShortWeekday(journal.date) },
    {
      key: 'director',
      header: 'Director(a)',
      render: (journal) => journal.homeroomTeacher?.fullName ?? '—',
    },
    ...(showReviewer
      ? [
          {
            key: 'reviewer',
            header: 'Revisa',
            render: (journal: FieldJournalSummary) => (
              <ReviewerText coordinator={coordinatorOf(journal)} />
            ),
          },
        ]
      : []),
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
        <StatusWithConsult
          consult={consults(journal)}
          badge={
            <StatusBadge tone={JOURNAL_STATUS_INFO[journal.status].tone}>
              {JOURNAL_STATUS_INFO[journal.status].shortLabel}
            </StatusBadge>
          }
        />
      ),
    },
    {
      key: 'action',
      header: 'Acción',
      render: (journal) => {
        const review = !consults(journal) && journal.status === JournalStatus.Submitted;
        return (
          <ButtonLink
            context={`diario de ${journal.group.name} del ${journal.date}`}
            href={`${path}/${journal.id}${query ? `?${query}` : ''}`}
            variant={review ? 'primary' : 'outline'}
            size="sm"
          >
            {review ? 'Revisar' : consults(journal) ? 'Ver' : 'Abrir'}
          </ButtonLink>
        );
      },
    },
  ];
}

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

/** Bandeja de diarios de campo de coordinación (`/coordinacion/formatos/diario`). */
export function JournalInboxScreen() {
  const paths = useRevisionPaths();
  const view = useView();
  const viewer = useInboxViewer();
  const { params, update } = useQueryParams();
  const scope = useJournalScope();
  const catalogs = useInboxCatalogs();
  const allGrades = useMemo<CatalogGradeScope[]>(
    () => (catalogs.state.status === 'ready' ? catalogs.state.data.grades : []),
    [catalogs.state],
  );
  const mine = useMemo(() => myGrades(viewer.user, allGrades), [viewer.user, allGrades]);
  const inboxScope = resolveScope(
    viewer.isCoordinator,
    catalogs.state.status !== 'ready' || mine.length > 0,
    params.get('vista'),
  );
  const noGrades = viewer.isCoordinator && catalogs.state.status === 'ready' && mine.length === 0;
  const showReviewer = viewer.isAdministrator || (viewer.isCoordinator && inboxScope === 'all');
  const vista = viewer.isCoordinator ? vistaParam(inboxScope) : null;
  const status = journalStatusFromUrl(params.get('estado'));
  const scopeData = scope.state.status === 'ready' ? scope.state.data : null;
  const gradeParam = params.get('grado');
  const gradeChoices = inboxScope === 'mine' ? mine : allGrades;
  const gradeId = gradeChoices.some((grade) => grade.id === gradeParam) ? gradeParam : null;
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
    coordinatorId: coordinatorFilter(inboxScope, viewer.isCoordinator, viewer.user?.id, undefined),
  });
  const statuses = scopeData?.unrestricted ? ADMIN_STATUSES : COORDINATOR_STATUSES;

  const inYourGrades = viewer.isCoordinator ? ' en tus grados' : '';
  const toggle = (filter: JournalStatus) => () =>
    update({ estado: status === filter ? null : filter });

  return (
    <PageContainer>
      <PageHeader
        context={view.title}
        title="Diarios de campo"
        description={
          viewer.isAdministrator
            ? 'Diarios de campo de todo el colegio, solo para consulta: la revisión es de la coordinadora de cada grado.'
            : 'Revisa los diarios de tus grados con las anotaciones de todos sus docentes: devuélvelos con observaciones o apruébalos con tu firma. Los demás los consultas.'
        }
        back={{ href: paths.hub, label: 'Volver a Formatos' }}
      />
      <div className={styles.list}>
        {scope.state.status === 'error' ? (
          <LoadError
            error={scope.state.error}
            title="No pudimos cargar tu alcance"
            onRetry={scope.reload}
          />
        ) : null}
        {noGrades ? (
          <Notice tone="info" title="Sin grados asignados">
            {noGradesMessage('los diarios')}
          </Notice>
        ) : null}
        {viewer.isCoordinator && !noGrades ? (
          <InboxScopeFilter
            grades={mine}
            scope={inboxScope}
            onChange={(value) => update({ vista: vistaParam(value), grado: null, grupo: null })}
          />
        ) : null}
        {viewer.isCoordinator && inboxScope === 'all' && !noGrades ? (
          <Notice tone="info">
            Las cifras de arriba siguen contando solo tus grados. Los diarios de los demás grados
            solo los consultas.
          </Notice>
        ) : null}
        {scopeData ? (
          <StatStrip
            label="Diarios por estado"
            neutral={viewer.isAdministrator}
            items={[
              {
                key: JournalStatus.Submitted,
                icon: 'bitacora',
                value: scopeData.counts.submitted,
                label: `Pendientes de revisión${inYourGrades}`,
                selected: status === JournalStatus.Submitted,
                onSelect: toggle(JournalStatus.Submitted),
              },
              {
                key: JournalStatus.ChangesRequested,
                icon: 'comentario',
                value: scopeData.counts.changesRequested,
                label: `Con observaciones${inYourGrades}`,
                selected: status === JournalStatus.ChangesRequested,
                onSelect: toggle(JournalStatus.ChangesRequested),
              },
              {
                key: JournalStatus.Reviewed,
                icon: 'check',
                value: scopeData.counts.reviewed,
                label: `Revisados${inYourGrades}`,
                selected: status === JournalStatus.Reviewed,
                onSelect: toggle(JournalStatus.Reviewed),
              },
            ]}
          />
        ) : null}

        {
          <Card title="Diarios de los grupos" className={styles.panel}>
            <FilterBar label="Filtros de los diarios">
              <Select
                size="sm"
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
                size="sm"
                label="Grado"
                placeholder={inboxScope === 'mine' ? 'Todos mis grados' : 'Todos los grados'}
                options={gradeChoices.map((grade) => ({
                  value: grade.id,
                  label: grade.name,
                }))}
                value={gradeId ?? ''}
                onChange={(event) => update({ grado: event.target.value || null, grupo: null })}
              />
              <Select
                size="sm"
                label="Grupo"
                placeholder="Todos"
                options={groups.map((group) => ({ value: group.id, label: group.name }))}
                value={groupId ?? ''}
                onChange={(event) => update({ grupo: event.target.value || null })}
              />
              <TextInput
                size="sm"
                label="Desde"
                type="date"
                value={from ?? ''}
                onChange={(event) => update({ desde: event.target.value || null })}
              />
              <TextInput
                size="sm"
                label="Hasta"
                type="date"
                value={to ?? ''}
                onChange={(event) => update({ hasta: event.target.value || null })}
              />
            </FilterBar>

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
                  embedded
                  caption="Diarios de los grupos"
                  getRowHref={(journal) =>
                    `${paths.journals}/${journal.id}${vista ? `?vista=${vista}` : ''}`
                  }
                  columns={journalColumns({
                    path: paths.journals,
                    query: vista ? `vista=${vista}` : '',
                    user: viewer.user,
                    grades: allGrades,
                    showReviewer,
                  })}
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
          </Card>
        }
      </div>
    </PageContainer>
  );
}
