'use client';

import { ObserverNoteType } from '@gns/shared';
import { useMemo } from 'react';

import { useQueryParams } from '@/shared/data';
import { myGrades, type CatalogGradeScope } from '@/shared/records';
import { useView } from '@/shared/shell';
import {
  ButtonLink,
  Notice,
  PageContainer,
  PageHeader,
  Select,
  type SelectOption,
} from '@/shared/ui';

import { useInboxViewer } from '../hooks/use-inbox-viewer';
import { useNoteInbox } from '../hooks/use-format-inbox';
import { useInboxCatalogs } from '../hooks/use-plan-inbox';
import { useRevisionPaths } from '../hooks/use-revision-paths';
import { coordinatorFilter, noGradesMessage, resolveScope, vistaParam } from '../model/inbox-scope';
import { InboxList, noteColumns, statusFromUrl } from './inbox-list';
import { InboxScopeFilter } from './inbox-scope-filter';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** Bandeja de observadores de coordinación y administración (`<vista>/formatos/observador`). */
export function ObserverInboxScreen() {
  const paths = useRevisionPaths();
  const view = useView();
  const viewer = useInboxViewer();
  const { params, update } = useQueryParams();
  const catalogs = useInboxCatalogs();
  const grades = useMemo<CatalogGradeScope[]>(
    () => (catalogs.state.status === 'ready' ? catalogs.state.data.grades : []),
    [catalogs.state],
  );
  const mine = useMemo(() => myGrades(viewer.user, grades), [viewer.user, grades]);
  const scope = resolveScope(
    viewer.isCoordinator,
    catalogs.state.status !== 'ready' || mine.length > 0,
    params.get('vista'),
  );
  const chosen = params.get('coordinatorId');
  const chosenCoordinator = chosen === 'none' || UUID.test(chosen ?? '') ? chosen : null;
  const status = statusFromUrl(params.get('estado'));
  const list = useNoteInbox({
    status,
    coordinatorId: coordinatorFilter(
      scope,
      viewer.isCoordinator,
      viewer.user?.id,
      chosenCoordinator ?? undefined,
    ),
  });
  const priority = list.items.some(
    (note) => note.type === ObserverNoteType.TypeIII || note.type === ObserverNoteType.TypeII,
  );
  const noGrades = viewer.isCoordinator && catalogs.state.status === 'ready' && mine.length === 0;
  const showReviewer = viewer.isAdministrator || (viewer.isCoordinator && scope === 'all');
  const vista = viewer.isCoordinator ? vistaParam(scope) : null;
  const coordinatorOptions = useMemo<SelectOption[]>(() => {
    const seen = new Map<string, string>();
    for (const grade of grades) {
      if (grade.coordinator) {
        seen.set(grade.coordinator.id, grade.coordinator.fullName);
      }
    }
    return [
      ...[...seen]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es')),
      { value: 'none', label: 'Sin coordinadora' },
    ];
  }, [grades]);

  return (
    <PageContainer>
      <PageHeader
        context={view.title}
        title="Observadores"
        description={
          viewer.isAdministrator
            ? 'Anotaciones del observador del estudiante de todo el colegio, solo para consulta: la revisión es de la coordinadora de cada grado.'
            : 'Revisa las anotaciones del observador de tus grados: devuélvelas con observaciones o apruébalas con tu firma. Las de los demás grados solo las consultas.'
        }
        actions={
          <ButtonLink href={paths.hub} variant="outline" startIcon="volver">
            Formatos
          </ButtonLink>
        }
      />
      <InboxList
        list={list}
        caption="Anotaciones del observador de los docentes"
        columns={noteColumns({
          path: paths.observers,
          query: vista ? `vista=${vista}` : '',
          user: viewer.user,
          grades,
          showReviewer,
        })}
        getRowKey={(note) => note.id}
        status={status}
        onStatusChange={(value) => update({ estado: value })}
        loading="Cargando las anotaciones…"
        loadError="No pudimos cargar las anotaciones"
        count={(total) => (total === 1 ? '1 anotación' : `${total} anotaciones`)}
        toolbar={
          <>
            {noGrades ? (
              <Notice tone="info" title="Sin grados asignados">
                {noGradesMessage('las anotaciones')}
              </Notice>
            ) : null}
            {viewer.isCoordinator && !noGrades ? (
              <InboxScopeFilter
                grades={mine}
                scope={scope}
                onChange={(value) => update({ vista: vistaParam(value) })}
              />
            ) : null}
            {viewer.isAdministrator ? (
              <Select
                label="Coordinadora"
                placeholder="Todas"
                options={coordinatorOptions}
                value={chosenCoordinator ?? ''}
                disabled={coordinatorOptions.length === 1}
                onChange={(event) => update({ coordinatorId: event.target.value })}
              />
            ) : null}
          </>
        }
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
