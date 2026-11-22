'use client';

import { RecordStatus, lessonPlanAreasLabel, type LessonPlan } from '@gns/shared';
import { useMemo } from 'react';

import { LoadError, Loading, useQueryParams } from '@/shared/data';
import { formatShortDate } from '@/shared/format/dates';
import {
  STATUS_INFO,
  STATUS_ORDER,
  canReviewGrade,
  coordinatorOfGrade,
  myGrades,
  type CatalogGradeScope,
  type GradeCoordinator,
  type ReviewUser,
} from '@/shared/records';
import { useView } from '@/shared/shell';
import {
  Button,
  ButtonLink,
  DataTable,
  Notice,
  PageContainer,
  PageHeader,
  Select,
  StatusBadge,
  type DataTableColumn,
  type SelectOption,
} from '@/shared/ui';

import {
  useCompliance,
  useInboxCatalogs,
  usePlanIndicators,
  usePlanList,
} from '../hooks/use-plan-inbox';
import {
  hasActiveFilters,
  planFiltersFromParams,
  planFiltersToQuery,
  type PlanFilters,
} from '../model/plan-filters';
import { coordinatorFilter, noGradesMessage, resolveScope, vistaParam } from '../model/inbox-scope';
import { shortStatusLabel } from '../model/status-label';
import { useInboxViewer } from '../hooks/use-inbox-viewer';
import { useRevisionPaths } from '../hooks/use-revision-paths';
import { CompliancePanel } from './compliance-panel';
import { ReviewerText, StatusWithConsult } from './consult-cells';
import { InboxIndicators } from './inbox-indicators';
import { InboxScopeFilter } from './inbox-scope-filter';
import styles from './plan-inbox-screen.module.css';

/** «P1» a la vista; los lectores de pantalla oyen «Periodo 1». */
function PeriodCell({ number }: { number: number }) {
  return (
    <>
      <span aria-hidden="true">{`P${number}`}</span>
      <span className="sr-only">{`Periodo ${number}`}</span>
    </>
  );
}

interface ColumnContext {
  /** Query con los filtros activos (y la vista) para volver a la bandeja desde la planeación. */
  query: string;
  planPath: string;
  user: ReviewUser | null;
  grades: readonly CatalogGradeScope[];
  /** Muestra la columna «Revisa»: coordinación en «Todo el colegio» y administración. */
  showReviewer: boolean;
}

function planColumns({
  query,
  planPath,
  user,
  grades,
  showReviewer,
}: ColumnContext): DataTableColumn<LessonPlan>[] {
  const coordinatorOf = (plan: LessonPlan): GradeCoordinator | null =>
    coordinatorOfGrade(grades, plan.grade.id);
  const consults = (plan: LessonPlan) => !canReviewGrade(user, coordinatorOf(plan));
  return [
    { key: 'teacher', header: 'Docente', render: (plan) => plan.teacher.fullName },
    {
      key: 'plan',
      header: 'Asignatura y tema',
      render: (plan) => (
        <span className={styles.plan}>
          <strong>{lessonPlanAreasLabel(plan.areas)}</strong>
          <span>{plan.topic ?? 'Sin tema'}</span>
        </span>
      ),
    },
    { key: 'grade', header: 'Grado', render: (plan) => plan.grade.name },
    ...(showReviewer
      ? [
          {
            key: 'reviewer',
            header: 'Revisa',
            render: (plan: LessonPlan) => <ReviewerText coordinator={coordinatorOf(plan)} />,
          },
        ]
      : []),
    {
      key: 'period',
      header: 'Periodo',
      render: (plan) => <PeriodCell number={plan.period.number} />,
    },
    {
      key: 'submitted',
      header: 'Enviada',
      render: (plan) => (plan.submittedAt ? formatShortDate(plan.submittedAt) : '—'),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (plan) => (
        <StatusWithConsult
          consult={consults(plan)}
          badge={
            <StatusBadge tone={STATUS_INFO[plan.status].tone}>
              {shortStatusLabel(plan.status)}
            </StatusBadge>
          }
        />
      ),
    },
    {
      key: 'action',
      header: 'Acción',
      render: (plan) => {
        const review = !consults(plan) && plan.status === RecordStatus.Submitted;
        return (
          <ButtonLink
            context={`planeación de ${plan.teacher.fullName}, ${plan.grade.name} ${lessonPlanAreasLabel(plan.areas)}`}
            href={`${planPath}/${plan.id}${query ? `?${query}` : ''}`}
            variant={review ? 'primary' : 'outline'}
            size="sm"
          >
            {review ? 'Revisar' : consults(plan) ? 'Ver' : 'Abrir'}
          </ButtonLink>
        );
      },
    },
  ];
}

/** Bandeja de planeaciones de coordinación: indicadores, filtros en la URL, lista y cumplimiento. */
export function PlanInboxScreen() {
  const paths = useRevisionPaths();
  const view = useView();
  const viewer = useInboxViewer();
  const { params, update } = useQueryParams();
  const filters = planFiltersFromParams(params);
  const catalogs = useInboxCatalogs();
  const grades = useMemo<CatalogGradeScope[]>(
    () => (catalogs.state.status === 'ready' ? catalogs.state.data.grades : []),
    [catalogs.state],
  );
  const mine = useMemo(() => myGrades(viewer.user, grades), [viewer.user, grades]);
  // Mientras carga el catálogo, coordinación empieza en «Mis grados»: así no parpadea todo el colegio.
  const scope = resolveScope(
    viewer.isCoordinator,
    catalogs.state.status !== 'ready' || mine.length > 0,
    params.get('vista'),
  );
  const listFilters: PlanFilters = {
    ...filters,
    coordinatorId: coordinatorFilter(
      scope,
      viewer.isCoordinator,
      viewer.user?.id,
      filters.coordinatorId,
    ),
  };
  const list = usePlanList(listFilters);
  // Las cifras siguen contando solo los grados propios de coordinación, también en «Todo el colegio».
  const indicators = usePlanIndicators(
    viewer.isCoordinator ? { ...filters, coordinatorId: viewer.user?.id } : listFilters,
  );
  const compliance = useCompliance();
  const noPending = params.get('aviso') === 'sin-pendientes';
  const noGrades = viewer.isCoordinator && catalogs.state.status === 'ready' && mine.length === 0;
  const showReviewer = viewer.isAdministrator || (viewer.isCoordinator && scope === 'all');

  const periodOptions = useMemo<SelectOption[]>(
    () =>
      compliance.state.status === 'ready'
        ? [...compliance.state.data.periods]
            .sort((a, b) => a.number - b.number)
            .map((period) => ({ value: period.id, label: `Periodo ${period.number}` }))
        : [],
    [compliance.state],
  );
  const teacherOptions = useMemo<SelectOption[]>(
    () =>
      compliance.state.status === 'ready'
        ? compliance.state.data.teachers
            .map((entry) => ({ value: entry.teacher.id, label: entry.teacher.fullName }))
            .sort((a, b) => a.label.localeCompare(b.label, 'es'))
        : [],
    [compliance.state],
  );
  const gradeOptions: SelectOption[] = (scope === 'mine' ? mine : grades).map((grade) => ({
    value: grade.id,
    label: grade.name,
  }));
  const coordinatorOptions = useMemo<SelectOption[]>(() => {
    const seen = new Map<string, string>();
    for (const grade of grades) {
      if (grade.coordinator) {
        seen.set(grade.coordinator.id, grade.coordinator.fullName);
      }
    }
    return [
      ...[...seen]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es')),
      { value: 'none', label: 'Sin coordinadora' },
    ];
  }, [grades]);
  const areaOptions = useMemo<SelectOption[]>(
    () =>
      catalogs.state.status === 'ready'
        ? catalogs.state.data.areas.map((area) => ({ value: area.id, label: area.name }))
        : [],
    [catalogs.state],
  );
  const statusOptions = useMemo<SelectOption[]>(
    () => STATUS_ORDER.map((status) => ({ value: status, label: STATUS_INFO[status].filterLabel })),
    [],
  );
  const vista = viewer.isCoordinator ? vistaParam(scope) : null;
  const backQuery = [planFiltersToQuery(filters), vista ? `vista=${vista}` : '']
    .filter(Boolean)
    .join('&');
  const columns = planColumns({
    query: backQuery,
    planPath: paths.plans,
    user: viewer.user,
    grades,
    showReviewer,
  });

  return (
    <PageContainer>
      <PageHeader
        context={view.title}
        title="Planeaciones"
        description={
          viewer.isAdministrator
            ? 'Planeaciones de todo el colegio, solo para consulta: la revisión es de la coordinadora de cada grado.'
            : 'Revisa las planeaciones de tus grados: apruébalas, ajústalas o devuélvelas con observaciones. Las de los demás grados solo las consultas.'
        }
        actions={
          <ButtonLink href={paths.hub} variant="outline" startIcon="volver">
            Formatos
          </ButtonLink>
        }
      />
      <div className={styles.root}>
        {noGrades ? (
          <Notice tone="info" title="Sin grados asignados">
            {noGradesMessage('las planeaciones')}
          </Notice>
        ) : null}
        {viewer.isCoordinator && !noGrades ? (
          <InboxScopeFilter
            grades={mine}
            scope={scope}
            onChange={(value) => update({ vista: vistaParam(value), aviso: null, gradeId: null })}
          />
        ) : null}
        {viewer.isCoordinator && scope === 'all' && !noGrades ? (
          <Notice tone="info">
            Las cifras de arriba siguen contando solo tus grados. Las planeaciones de los demás
            grados solo las consultas.
          </Notice>
        ) : null}
        {noPending ? (
          <Notice tone="success" title="Sin pendientes">
            Aprobaste la planeación. No quedan más planeaciones enviadas por revisar.
          </Notice>
        ) : null}
        <InboxIndicators
          remote={indicators}
          active={filters.status}
          onSelect={(status) => update({ status, aviso: null })}
        />
        <div className={styles.filters}>
          <Select
            label="Estado"
            placeholder="Todos los estados"
            options={statusOptions}
            value={filters.status ?? ''}
            onChange={(event) => update({ status: event.target.value, aviso: null })}
          />
          <Select
            label="Grado"
            placeholder="Todos los grados"
            options={gradeOptions}
            value={filters.gradeId ?? ''}
            disabled={gradeOptions.length === 0}
            onChange={(event) => update({ gradeId: event.target.value, aviso: null })}
          />
          <Select
            label="Asignatura"
            placeholder="Todas las asignaturas"
            options={areaOptions}
            value={filters.areaId ?? ''}
            disabled={areaOptions.length === 0}
            onChange={(event) => update({ areaId: event.target.value, aviso: null })}
          />
          <Select
            label="Periodo"
            placeholder="Todos los periodos"
            options={periodOptions}
            value={filters.periodId ?? ''}
            disabled={periodOptions.length === 0}
            onChange={(event) => update({ periodId: event.target.value, aviso: null })}
          />
          {viewer.isAdministrator ? (
            <Select
              label="Coordinadora"
              placeholder="Todas"
              options={coordinatorOptions}
              value={filters.coordinatorId ?? ''}
              disabled={coordinatorOptions.length === 1}
              onChange={(event) => update({ coordinatorId: event.target.value, aviso: null })}
            />
          ) : null}
          <Select
            label="Docente"
            placeholder="Todos los docentes"
            options={teacherOptions}
            value={filters.teacherId ?? ''}
            disabled={teacherOptions.length === 0}
            onChange={(event) => update({ teacherId: event.target.value, aviso: null })}
          />
        </div>

        {list.status === 'loading' ? <Loading>Cargando las planeaciones…</Loading> : null}
        {list.status === 'error' && list.error ? (
          <LoadError
            error={list.error}
            title="No pudimos cargar las planeaciones"
            onRetry={list.reload}
          />
        ) : null}
        {list.status === 'ready' ? (
          <>
            <p className={styles.count} role="status">
              {list.totalItems === 1 ? '1 planeación' : `${list.totalItems} planeaciones`}
            </p>
            <DataTable
              caption="Planeaciones de los docentes"
              columns={columns}
              rows={list.items}
              getRowKey={(plan) => plan.id}
              emptyMessage={
                hasActiveFilters(filters)
                  ? 'Ninguna planeación cumple estos filtros. Cambia o quita alguno para ver más.'
                  : 'Aún no hay planeaciones.'
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

        <CompliancePanel
          remote={compliance}
          periodId={filters.periodId}
          teacherId={filters.teacherId}
          gradeIds={
            viewer.isCoordinator && scope === 'mine'
              ? new Set(mine.map((grade) => grade.id))
              : undefined
          }
        />
      </div>
    </PageContainer>
  );
}
