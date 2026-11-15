'use client';

import { RecordStatus, type LessonPlan } from '@gns/shared';
import { useMemo } from 'react';

import { formatDateRange, formatShortDate } from '@/shared/format/dates';
import { useSession } from '@/shared/session';
import {
  Button,
  ButtonLink,
  Notice,
  RecordCard,
  SegmentedFilter,
  Select,
  StatusBadge,
  type SegmentedOption,
  type SelectOption,
} from '@/shared/ui';

import { useLessonPlanList } from '../hooks/use-lesson-plan-list';
import { useQueryParams } from '../hooks/use-query-params';
import { useTeachingContext } from '../hooks/use-teaching-context';
import { STATUS_INFO, STATUS_ORDER, isEditable } from '../model/status';
import { LoadError, Loading } from './load-error';
import styles from './lesson-plan-list.module.css';

const ALL = 'todas';

function statusFromUrl(value: string | null): RecordStatus | undefined {
  return STATUS_ORDER.find((status) => status === value);
}

const STATUS_OPTIONS: SegmentedOption<string>[] = [
  { value: ALL, label: 'Todas' },
  ...STATUS_ORDER.map((status) => ({ value: status, label: STATUS_INFO[status].filterLabel })),
];

function PlanCard({ plan }: { plan: LessonPlan }) {
  const info = STATUS_INFO[plan.status];
  const dates = formatDateRange(plan.dateFrom, plan.dateTo);
  return (
    <li className={styles.item}>
      <RecordCard
        title={`${plan.area.name} · ${plan.topic ?? 'Sin tema'}`}
        headingLevel={2}
        tone={info.tone}
        status={<StatusBadge tone={info.tone}>{info.label}</StatusBadge>}
        meta={[
          `${plan.grade.name} · P${plan.period.number}`,
          dates,
          `Actualizada ${formatShortDate(plan.updatedAt)}`,
        ].filter((entry): entry is string => Boolean(entry))}
        actions={
          <ButtonLink
            href={`/docente/planeacion/${plan.id}`}
            variant="outline"
            size="sm"
            className={styles.stretched}
          >
            {isEditable(plan.status) ? 'Continuar' : 'Ver'}
            <span className="sr-only">{`: ${plan.area.name} · ${plan.topic ?? 'Sin tema'}`}</span>
          </ButtonLink>
        }
      >
        {plan.expectedPerformance ? (
          <p className={styles.performance}>{plan.expectedPerformance}</p>
        ) : null}
      </RecordCard>
    </li>
  );
}

/** «Mis planeaciones»: lista paginada de las planeaciones de quien está en sesión, con filtros. */
export function LessonPlanList() {
  const { state: session } = useSession();
  const teacherId = session.status === 'authenticated' ? session.user.id : undefined;
  const { params, update } = useQueryParams();
  const teaching = useTeachingContext();

  const status = statusFromUrl(params.get('estado'));
  const periodId = params.get('periodo') ?? undefined;
  const assignment = params.get('asignacion') ?? undefined;
  const [gradeId, areaId] = assignment?.split(':') ?? [];

  const list = useLessonPlanList({ teacherId, status, periodId, gradeId, areaId });

  const periodOptions = useMemo<SelectOption[]>(
    () =>
      teaching.state.status === 'ready'
        ? teaching.state.data.periods.map((period) => ({
            value: period.id,
            label: `Periodo ${period.number}`,
          }))
        : [],
    [teaching.state],
  );
  const assignmentOptions = useMemo<SelectOption[]>(
    () =>
      teaching.state.status === 'ready'
        ? [...teaching.state.data.grades]
            .sort((a, b) => a.grade.sortOrder - b.grade.sortOrder)
            .flatMap((entry) =>
              entry.areas.map((area) => ({
                value: `${entry.grade.id}:${area.id}`,
                label: `${entry.grade.name} · ${area.name}`,
              })),
            )
        : [],
    [teaching.state],
  );

  if (!teacherId) {
    return null;
  }
  const filtered = Boolean(status || periodId || assignment);

  return (
    <div className={styles.root}>
      <div className={styles.filters}>
        <SegmentedFilter
          label="Filtrar por estado"
          options={STATUS_OPTIONS}
          value={status ?? ALL}
          onChange={(value) => update({ estado: value === ALL ? null : value })}
        />
        <div className={styles.selects}>
          <Select
            label="Periodo"
            placeholder="Todos los periodos"
            options={periodOptions}
            value={periodId ?? ''}
            disabled={periodOptions.length === 0}
            onChange={(event) => update({ periodo: event.target.value })}
          />
          <Select
            label="Grado y área"
            placeholder="Todos los grados y áreas"
            options={assignmentOptions}
            value={assignment ?? ''}
            disabled={assignmentOptions.length === 0}
            onChange={(event) => update({ asignacion: event.target.value })}
          />
        </div>
      </div>

      {list.status === 'loading' ? <Loading>Cargando tus planeaciones…</Loading> : null}
      {list.status === 'error' && list.error ? (
        <LoadError
          error={list.error}
          title="No pudimos cargar tus planeaciones"
          onRetry={list.reload}
        />
      ) : null}
      {list.status === 'ready' && list.items.length === 0 ? (
        <Notice tone="info" title={filtered ? 'Sin resultados' : 'Aún no tienes planeaciones'}>
          {filtered
            ? 'Ninguna planeación cumple estos filtros. Cambia o quita alguno para ver más.'
            : 'Crea tu primera planeación con el botón «Nueva planeación» o parte de una actividad del repositorio.'}
        </Notice>
      ) : null}
      {list.status === 'ready' && list.items.length > 0 ? (
        <>
          <p className={styles.count} role="status">
            {list.totalItems === 1 ? '1 planeación' : `${list.totalItems} planeaciones`}
          </p>
          <ul className={styles.grid}>
            {list.items.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </ul>
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
