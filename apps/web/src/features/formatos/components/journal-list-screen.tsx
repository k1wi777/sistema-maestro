import { ButtonLink, PageContainer, PageHeader } from '@/shared/ui';

import { FORMATS_HUB_PATH } from '../model/paths';
import { JournalList } from './journal-list';

/** Lista del docente en «Diario de campo (F-PA-05)» (`/docente/formatos/diario`). */
export function JournalListScreen() {
  return (
    <PageContainer>
      <PageHeader
        context="Formatos"
        title="Diario de campo (F-PA-05)"
        description="Una hoja por grado y periodo: registra los eventos de tus clases, envíala a coordinación y consulta sus observaciones."
        actions={
          <ButtonLink href={FORMATS_HUB_PATH} variant="outline" startIcon="volver">
            Formatos
          </ButtonLink>
        }
      />
      <JournalList />
    </PageContainer>
  );
}
