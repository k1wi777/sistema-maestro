'use client';

import { RecordStatus, type LessonPlan } from '@gns/shared';
import { useMemo } from 'react';

import { LoadError, Loading, useQueryParams } from '@/shared/data';
import { formatShortDate } from '@/shared/format/dates';
import { STATUS_INFO, STATUS_ORDER } from '@/shared/records';
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
import { shortStatusLabel } from '../model/status-label';
import { CompliancePanel } from './compliance-panel';
import { InboxIndicators } from './inbox-indicators';
import styles from './plan-inbox-screen.module.css';

const REVIEW_PATH = '/coordinacion/planeaciones';

/** «P1» a la vista; los lectores de pantalla oyen «Periodo 1». */
function PeriodCell({ number }: { number: number }) {
  return (
    <>
      <span aria-hidden="true">{`P${number}`}</span>
      <span className="sr-only">{`Periodo ${number}`}</span>
    </>
  );
}

function planColumns(filters: PlanFilters): DataTableColumn<LessonPlan>[] {
  const query = planFiltersToQuery(filters);
  return [
    { key: 'teacher', header: 'Docente', render: (plan) => plan.teacher.fullName },
    {
      key: 'plan',
      header: 'Asignatura y tema',
      render: (plan) => (
        <span className={styles.plan}>
          <strong>{plan.area.name}</strong>
          <span>{plan.topic ?? 'Sin tema'}</span>
        </span>
      ),
    },
    { key: 'grade', header: 'Grado', render: (plan) => plan.grade.name },
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
        <StatusBadge tone={STATUS_INFO[plan.status].tone}>
          {shortStatusLabel(plan.status)}
        </StatusBadge>
      ),
    },
    {
      key: 'action',
      header: 'Acción',
      render: (plan) => (
        <ButtonLink
          href={`${REVIEW_PATH}/${plan.id}${query ? `?${query}` : ''}`}
          variant={plan.status === RecordStatus.Submitted ? 'primary' : 'outline'}
          size="sm"
        >
          {plan.status === RecordStatus.Submitted ? 'Revisar' : 'Abrir'}
          <span className="sr-only">{`: ${plan.area.name} de ${plan.teacher.fullName}`}</span>
        </ButtonLink>
      ),
    },
  ];
}

/** Bandeja de planeaciones de coordinación: indicadores, filtros en la URL, lista y cumplimiento. */
export function PlanInboxScreen() {
  const { params, update } = useQueryParams();
  const filters = planFiltersFromParams(params);
  const list = usePlanList(filters);
  const indicators = usePlanIndicators(filters);
  const compliance = useCompliance();
  const catalogs = useInboxCatalogs();
  const noPending = params.get('aviso') === 'sin-pendientes';

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
  const gradeOptions = useMemo<SelectOption[]>(
    () =>
      catalogs.state.status === 'ready'
        ? catalogs.state.data.grades.map((grade) => ({ value: grade.id, label: grade.name }))
        : [],
    [catalogs.state],
  );
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
  const columns = planColumns(filters);

  return (
    <PageContainer>
      <PageHeader
        context="Coordinación académica"
        title="Planeaciones"
        description="Revisa, ajusta, aprueba o devuelve las planeaciones de los docentes."
      />
      <div className={styles.root}>
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
        />
      </div>
    </PageContainer>
  );
}
