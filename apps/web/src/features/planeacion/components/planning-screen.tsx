'use client';

import { ButtonLink, PageContainer, PageHeader, Tabs } from '@/shared/ui';

import { useQueryParams } from '../hooks/use-query-params';
import { LessonPlanList } from './lesson-plan-list';
import { RepositoryPanel } from './repository-panel';

const PLANS_TAB = 'mis-planeaciones';
const REPOSITORY_TAB = 'repositorio';

/** Planeación GNS: «Mis planeaciones» y el repositorio de la comunidad, en pestañas de la URL. */
export function PlanningScreen() {
  const { params, update } = useQueryParams();
  const tab = params.get('pestana') === REPOSITORY_TAB ? REPOSITORY_TAB : PLANS_TAB;

  return (
    <PageContainer>
      <PageHeader
        context="Modelo pedagógico GNS"
        title="Planeación GNS"
        description="Diseña tus clases con los momentos del modelo GNS e inspírate en las actividades que comparte la comunidad docente."
        actions={
          <ButtonLink href="/docente/planeacion/nueva" startIcon="mas">
            Nueva planeación
          </ButtonLink>
        }
      />
      <Tabs
        label="Planeación"
        value={tab}
        // Al cambiar de pestaña se descartan los filtros de la anterior: no tienen sentido en la otra.
        onChange={(id) =>
          update({
            pestana: id === PLANS_TAB ? null : id,
            estado: null,
            periodo: null,
            asignacion: null,
          })
        }
        tabs={[
          { id: PLANS_TAB, label: 'Mis planeaciones', content: <LessonPlanList /> },
          {
            id: REPOSITORY_TAB,
            label: 'Repositorio',
            content: <RepositoryPanel />,
          },
        ]}
      />
    </PageContainer>
  );
}
