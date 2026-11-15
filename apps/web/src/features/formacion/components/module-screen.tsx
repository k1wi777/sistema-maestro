'use client';

import { TeacherModuleState, type TeacherModule } from '@gns/shared';

import type { ApiError } from '@/shared/api';
import { LoadError, Loading } from '@/shared/data';
import { ButtonLink, Card, Notice, PageContainer, PageHeader, StatusBadge } from '@/shared/ui';

import { useModuleData, useModuleView } from '../hooks/use-training-module';
import { MODULE_STATE_INFO } from '../model/labels';
import { finishList, moduleSections, type SectionKind } from '../model/module-steps';
import { ActivitiesSection } from './activities-section';
import { ChallengeGame } from './challenge-game';
import { FinishList } from './finish-list';
import { ModuleDoneNotice } from './module-done-notice';
import { PresentationSection } from './presentation-section';
import styles from './module-screen.module.css';
import { ROUTE_HREF } from './training-header';
import { VideoSection } from './video-section';

/** Un módulo que no existe o no está en la ruta (404) o un id mal formado (400) no está disponible. */
const UNAVAILABLE_STATUSES = new Set([400, 404]);

const SECTION_TITLE: Record<SectionKind, string> = {
  video: 'Video',
  challenge: 'Desafío GNS',
  presentation: 'Presentación sugerida',
  activities: 'Actividades del módulo',
};

function BackToRoute() {
  return (
    <ButtonLink href={ROUTE_HREF} variant="outline" size="sm" startIcon="volver">
      Ruta de módulos
    </ButtonLink>
  );
}

function Unavailable() {
  return (
    <PageContainer>
      <Notice tone="warning" title="Este módulo no está disponible">
        No existe o no forma parte de tu ruta de formación.
      </Notice>
      <p>
        <BackToRoute />
      </p>
    </PageContainer>
  );
}

function ModuleView({
  data,
  refresh,
}: {
  data: TeacherModule;
  refresh: () => Promise<ApiError | null>;
}) {
  const { module, markVideo, markPresentation, progressChanged } = useModuleView(data, refresh);
  const sections = moduleSections(module);
  const state = MODULE_STATE_INFO[module.state];

  return (
    <PageContainer>
      <p>
        <BackToRoute />
      </p>
      <PageHeader
        context={`${module.section.title}${module.number ? ` · Módulo ${module.number}` : ''}`}
        title={module.title}
        description={module.summary ?? undefined}
        actions={<StatusBadge tone={state.tone}>{state.label}</StatusBadge>}
      />
      {module.state === TeacherModuleState.Done ? <ModuleDoneNotice moduleId={module.id} /> : null}
      {sections.length === 0 ? (
        <Notice tone="info" title="Este módulo aún no tiene contenidos">
          Coordinación académica todavía no ha agregado video, Desafío, presentación ni actividades.
          Vuelve más tarde.
        </Notice>
      ) : (
        <>
          <FinishList list={finishList(module)} />
          <div className={styles.stack}>
            {sections.map(({ kind, number }) => (
              <Card key={kind} title={SECTION_TITLE[kind]} step={number}>
                {kind === 'video' ? <VideoSection module={module} onMark={markVideo} /> : null}
                {kind === 'challenge' ? (
                  <ChallengeGame module={module} onFinished={progressChanged} />
                ) : null}
                {kind === 'presentation' ? (
                  <PresentationSection module={module} onMark={markPresentation} />
                ) : null}
                {kind === 'activities' ? (
                  <ActivitiesSection activities={module.activities} onProgress={progressChanged} />
                ) : null}
              </Card>
            ))}
          </div>
        </>
      )}
    </PageContainer>
  );
}

/** Vista de un módulo: muestra solo los contenidos que tiene, numerados según los que existan. */
export function TrainingModuleScreen({ id }: { id: string }) {
  const { state, reload, refresh } = useModuleData(id);

  if (state.status === 'loading') {
    return (
      <PageContainer>
        <Loading>Cargando el módulo…</Loading>
      </PageContainer>
    );
  }
  if (state.status === 'error') {
    return UNAVAILABLE_STATUSES.has(state.error.statusCode) ? (
      <Unavailable />
    ) : (
      <PageContainer>
        <LoadError error={state.error} onRetry={reload} />
        <p>
          <BackToRoute />
        </p>
      </PageContainer>
    );
  }
  return <ModuleView data={state.data} refresh={refresh} />;
}
