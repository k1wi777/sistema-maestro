import { ButtonLink, PageContainer, PageHeader } from '@/shared/ui';

import { FORMATS_HUB_PATH } from '../model/paths';
import { ObserverList } from './observer-list';

/** Lista del docente en «Observador del estudiante» (`/docente/formatos/observador`). */
export function ObserverListScreen() {
  return (
    <PageContainer>
      <PageHeader
        context="Formatos"
        title="Observador del estudiante"
        description="Registra anotaciones de convivencia y seguimiento, envíalas a coordinación y consulta sus observaciones."
        actions={
          <ButtonLink href={FORMATS_HUB_PATH} variant="outline" startIcon="volver">
            Formatos
          </ButtonLink>
        }
      />
      <ObserverList />
    </PageContainer>
  );
}
