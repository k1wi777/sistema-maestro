'use client';

import { PageContainer, PageHeader, Tabs } from '@/shared/ui';

import { useQueryParams } from '@/shared/data';
import { JournalList } from './journal-list';
import { ObserverList } from './observer-list';

const JOURNAL_TAB = 'diario';
const OBSERVER_TAB = 'observador';

/** Formatos institucionales: «Diario de campo» y «Observador del estudiante», en pestañas de la URL. */
export function FormatsScreen() {
  const { params, update } = useQueryParams();
  const tab = params.get('pestana') === OBSERVER_TAB ? OBSERVER_TAB : JOURNAL_TAB;

  return (
    <PageContainer>
      <PageHeader
        context="Formatos institucionales"
        title="Formatos"
        description="Diario de campo (F-PA-05) y observador del estudiante: registra, envía a coordinación y consulta sus observaciones."
      />
      <Tabs
        label="Formatos"
        value={tab}
        // El filtro por estado de una pestaña no tiene sentido en la otra.
        onChange={(id) => update({ pestana: id === JOURNAL_TAB ? null : id, estado: null })}
        tabs={[
          { id: JOURNAL_TAB, label: 'Diario de campo', content: <JournalList /> },
          { id: OBSERVER_TAB, label: 'Observador del estudiante', content: <ObserverList /> },
        ]}
      />
    </PageContainer>
  );
}
