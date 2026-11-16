'use client';

import { useQueryParams } from '@/shared/data';
import { ButtonLink, PageContainer, PageHeader } from '@/shared/ui';

import { useJournalInbox } from '../hooks/use-format-inbox';
import { FORMATS_HUB_PATH } from '../model/paths';
import { InboxList, JOURNAL_COLUMNS, statusFromUrl } from './inbox-list';

/** Bandeja de diarios de campo de coordinación (`/coordinacion/formatos/diario`). */
export function JournalInboxScreen() {
  const { params, update } = useQueryParams();
  const status = statusFromUrl(params.get('estado'));
  const list = useJournalInbox(status);

  return (
    <PageContainer>
      <PageHeader
        context="Coordinación académica"
        title="Diarios de campo"
        description="Revisa las hojas del diario de campo (F-PA-05): devuélvelas con observaciones o apruébalas con tu firma."
        actions={
          <ButtonLink href={FORMATS_HUB_PATH} variant="outline" startIcon="volver">
            Formatos
          </ButtonLink>
        }
      />
      <InboxList
        list={list}
        caption="Diarios de campo de los docentes"
        columns={JOURNAL_COLUMNS}
        getRowKey={(journal) => journal.id}
        status={status}
        onStatusChange={(value) => update({ estado: value })}
        loading="Cargando los diarios de campo…"
        loadError="No pudimos cargar los diarios de campo"
        count={(total) => (total === 1 ? '1 hoja' : `${total} hojas`)}
      />
    </PageContainer>
  );
}
