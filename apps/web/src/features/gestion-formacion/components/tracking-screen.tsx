'use client';

import { UserRole, type PlanTracking, type TrainingPlanSummary } from '@gns/shared';
import { useMemo, useState } from 'react';

import { LoadError, Loading, useQueryParams } from '@/shared/data';
import { CERTIFICATE_VERIFICATION_PATH } from '@/shared/legal';
import { useSession } from '@/shared/session';
import { useView } from '@/shared/shell';
import {
  Button,
  ButtonLink,
  Card,
  FilterBar,
  Notice,
  PageContainer,
  PageHeader,
  Select,
  StatStrip,
  TextInput,
  type IconName,
} from '@/shared/ui';

import { usePlanTracking, useTrackingExport, useTrackingPlans } from '../hooks/use-plan-tracking';
import { moduleTitleWithNumber } from '../model/labels';
import { buildPlanOptions, pickPlanOption } from '../model/plan-catalog';
import { moduleDetailView, trackingIndicators, validModuleId } from '../model/tracking-view';
import { ModuleDetail } from './module-detail';
import { TrackingMatrix } from './tracking-matrix';
import styles from './tracking-screen.module.css';

function Indicators({ tracking, neutral }: { tracking: PlanTracking; neutral: boolean }) {
  const indicators = trackingIndicators(tracking);
  const items: { key: string; icon: IconName; label: string; value: string }[] = [
    {
      key: 'teachers',
      icon: 'gente',
      label: 'docentes en el plan',
      value: String(indicators.teachers),
    },
    {
      key: 'overall',
      icon: 'grafica',
      label: 'avance general',
      value: indicators.overallPercent === null ? '—' : `${indicators.overallPercent}%`,
    },
    {
      key: 'finished',
      icon: 'check',
      label: 'terminaron todos los módulos',
      value: String(indicators.finishedAll),
    },
    {
      key: 'score',
      icon: 'estrella',
      label: 'promedio en los desafíos',
      value: indicators.averageScore === null ? '—' : `${indicators.averageScore}%`,
    },
    {
      key: 'modules',
      icon: 'plan',
      label: 'módulos publicados',
      value: String(indicators.modules),
    },
  ];
  return <StatStrip label="Indicadores del avance" neutral={neutral} items={items} />;
}

function PlanTrackingView({ planId, neutral }: { planId: string; neutral: boolean }) {
  const tracking = usePlanTracking(planId);
  const { params, update } = useQueryParams();
  const [query, setQuery] = useState('');

  if (tracking.state.status === 'loading') {
    return <Loading>Cargando el avance…</Loading>;
  }
  if (tracking.state.status === 'error') {
    return (
      <LoadError
        error={tracking.state.error}
        title="No pudimos cargar el avance"
        onRetry={tracking.reload}
      />
    );
  }
  const data = tracking.state.data;
  const moduleId = validModuleId(data, params.get('modulo'));
  const detail = moduleId ? moduleDetailView(data, moduleId, query) : null;
  const teacherEmpty =
    query.trim() === ''
      ? 'Todavía no hay docentes con este plan en su ruta.'
      : 'Ningún docente coincide con la búsqueda.';

  return (
    <>
      {data.modules.length === 0 ? (
        <Notice tone="info" title="Este plan no tiene módulos publicados">
          El avance aparece cuando publicas módulos del plan y los docentes empiezan a recorrerlos.
        </Notice>
      ) : null}
      <Indicators tracking={data} neutral={neutral} />
      <Card title="Avance por docente en la formación">
        <FilterBar label="Filtros del avance" className={styles.filters}>
          <Select
            size="sm"
            label="Módulo"
            value={moduleId}
            placeholder="Todos los módulos (vista general)"
            options={data.modules.map((module) => ({
              value: module.id,
              label: moduleTitleWithNumber(module),
            }))}
            onChange={(event) => update({ modulo: event.target.value })}
          />
          <TextInput
            size="sm"
            label="Buscar docente"
            type="search"
            value={query}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
        </FilterBar>
        <TrackingMatrix tracking={data} query={query} />
        <p className={styles.note}>
          Aparecen los docentes que tienen este plan en su ruta del año vigente.
        </p>
      </Card>
      {detail ? (
        <ModuleDetail
          view={detail}
          teacherCount={data.teachers.length}
          emptyMessage={teacherEmpty}
        />
      ) : null}
    </>
  );
}

function TrackingBody({ plans }: { plans: TrainingPlanSummary[] }) {
  const view = useView();
  const { state } = useSession();
  const isAdministrator =
    state.status === 'authenticated' && state.user.role === UserRole.Administrator;
  const { params, update } = useQueryParams();
  const options = useMemo(() => {
    const areas = new Map<string, string>();
    for (const plan of plans) {
      if (plan.areaId && plan.areaName) {
        areas.set(plan.areaId, plan.areaName);
      }
    }
    const areaList = [...areas].map(([id, name]) => ({ id, name }));
    return buildPlanOptions(plans, areaList).filter((option) => option.plan !== null);
  }, [plans]);
  const option = pickPlanOption(options, { plan: params.get('plan'), area: null });
  const planId = option?.plan?.id ?? null;
  const exporter = useTrackingExport(planId);

  return (
    <PageContainer>
      <PageHeader
        context={view.title}
        title="Avance en la formación"
        description="Progreso de cada docente por plan y módulo. Descarga el seguimiento cuando lo necesites."
        actions={
          <>
            <ButtonLink
              variant="outline"
              endIcon="externo"
              href={CERTIFICATE_VERIFICATION_PATH}
              target="_blank"
              rel="noopener noreferrer"
            >
              Verificar un certificado
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </ButtonLink>
            <Button
              variant="secondary"
              startIcon="bajar"
              disabled={planId === null || exporter.busy}
              onClick={() => void exporter.start()}
            >
              {exporter.busy ? 'Descargando…' : 'Descargar CSV'}
            </Button>
          </>
        }
      />
      <div className={styles.root}>
        {exporter.error ? (
          <Notice tone="error" title="No pudimos descargar el CSV">
            {exporter.error.message}
          </Notice>
        ) : null}
        {option === null ? (
          <Notice tone="info" title="Aún no hay planes de formación">
            Crea un módulo en «Planes de formación» para empezar a ver el avance de los docentes.
          </Notice>
        ) : (
          <>
            <FilterBar label="Plan de formación" compact>
              <Select
                size="sm"
                label="Plan de formación"
                value={option.key}
                options={options.map((item) => ({ value: item.key, label: item.label }))}
                onChange={(event) => update({ plan: event.target.value, modulo: null })}
              />
            </FilterBar>
            <PlanTrackingView key={option.key} planId={option.key} neutral={isAdministrator} />
          </>
        )}
      </div>
    </PageContainer>
  );
}

/** «Avance en la formación» (`/coordinacion/avance`): plan y módulo en la URL, matriz y CSV. */
export function TrackingScreen() {
  const plans = useTrackingPlans();

  if (plans.state.status === 'loading') {
    return (
      <PageContainer>
        <Loading>Cargando los planes de formación…</Loading>
      </PageContainer>
    );
  }
  if (plans.state.status === 'error') {
    return (
      <PageContainer>
        <LoadError
          error={plans.state.error}
          title="No pudimos cargar los planes"
          onRetry={plans.reload}
        />
      </PageContainer>
    );
  }
  return <TrackingBody plans={plans.state.data} />;
}
