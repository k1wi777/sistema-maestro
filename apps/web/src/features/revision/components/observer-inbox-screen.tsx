'use client';

import { ObserverNoteType } from '@gns/shared';

import { useQueryParams } from '@/shared/data';
import { ButtonLink, Notice, PageContainer, PageHeader } from '@/shared/ui';

import { useNoteInbox } from '../hooks/use-format-inbox';
import { FORMATS_HUB_PATH } from '../model/paths';
import { InboxList, NOTE_COLUMNS, statusFromUrl } from './inbox-list';

/** Bandeja de observadores de coordinación (`/coordinacion/formatos/observador`). */
export function ObserverInboxScreen() {
  const { params, update } = useQueryParams();
  const status = statusFromUrl(params.get('estado'));
  const list = useNoteInbox(status);
  const priority = list.items.some(
    (note) => note.type === ObserverNoteType.TypeIII || note.type === ObserverNoteType.TypeII,
  );

  return (
    <PageContainer>
      <PageHeader
        context="Coordinación académica"
        title="Observadores"
        description="Revisa las anotaciones del observador del estudiante: devuélvelas con observaciones o apruébalas con tu firma."
        actions={
          <ButtonLink href={FORMATS_HUB_PATH} variant="outline" startIcon="volver">
            Formatos
          </ButtonLink>
        }
      />
      <InboxList
        list={list}
        caption="Anotaciones del observador de los docentes"
        columns={NOTE_COLUMNS}
        getRowKey={(note) => note.id}
        status={status}
        onStatusChange={(value) => update({ estado: value })}
        loading="Cargando las anotaciones…"
        loadError="No pudimos cargar las anotaciones"
        count={(total) => (total === 1 ? '1 anotación' : `${total} anotaciones`)}
        intro={
          <Notice tone={priority ? 'warning' : 'info'}>
            Las situaciones de convivencia Tipo III y Tipo II aparecen primero. Las anotaciones son
            confidenciales: solo llevan el nombre de pila del estudiante.
          </Notice>
        }
      />
    </PageContainer>
  );
}
