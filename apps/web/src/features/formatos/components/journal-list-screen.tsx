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
        description="Registra los eventos de tus clases en el diario de cada grupo y día y consulta las observaciones de coordinación."
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
