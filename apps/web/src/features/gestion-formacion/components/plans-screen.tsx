'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { LoadError, Loading, useQueryParams } from '@/shared/data';
import { useView } from '@/shared/shell';
import { Button, EmptyState, Icon, Notice, PageContainer, PageHeader, Select } from '@/shared/ui';

import {
  useModuleActions,
  usePlansCatalog,
  usePlanView,
  type PlansCatalog,
} from '../hooks/use-plans';
import { moduleTitleWithNumber } from '../model/labels';
import { withdrawConfirmation } from '../model/module-actions';
import { moduleGroups, trackingByModule } from '../model/module-outline';
import {
  buildPlanOptions,
  optionByKey,
  optionToParams,
  pickPlanOption,
} from '../model/plan-catalog';
import { ModuleActionDialog } from './module-action-dialog';
import { ModuleRow } from './module-row';
import { NewModuleDialog } from './new-module-dialog';
import { NewSectionDialog } from './new-section-dialog';
import styles from './plans-screen.module.css';

interface NewModuleTarget {
  /** Sección fija; `null` en un área sin plan (el módulo crea plan y sección). */
  section: { id: string; title: string } | null;
}

interface PendingWithdraw {
  id: string;
  title: string;
}

function PlansView({
  catalog,
  reloadCatalog,
}: {
  catalog: PlansCatalog;
  reloadCatalog: () => void;
}) {
  const shell = useView();
  const router = useRouter();
  const { params, update } = useQueryParams();
  const options = useMemo(
    () => buildPlanOptions(catalog.plans, catalog.areas),
    [catalog.plans, catalog.areas],
  );
  const option = pickPlanOption(options, { plan: params.get('plan'), area: params.get('area') });
  const view = usePlanView(option?.plan?.id ?? null);
  const actions = useModuleActions(view.refresh);

  const [creating, setCreating] = useState<NewModuleTarget | null>(null);
  const [creatingSection, setCreatingSection] = useState(false);
  const [createdSection, setCreatedSection] = useState<{ id: string; title: string } | null>(null);
  const [withdrawing, setWithdrawing] = useState<PendingWithdraw | null>(null);

  const viewData = view.state.status === 'ready' ? view.state.data : null;
  const tracking = viewData?.tracking ?? null;
  const totals = useMemo(() => trackingByModule(tracking), [tracking]);
  const groups = useMemo(() => (viewData ? moduleGroups(viewData.tree) : []), [viewData]);

  // Tras crear una sección y recargar el plan, el foco pasa a su título (el botón que la creó ya no existe).
  const focusId = createdSection?.id ?? null;
  const hasFocusTarget = groups.some((group) => group.section.id === focusId);
  useEffect(() => {
    if (focusId !== null && hasFocusTarget) {
      document.getElementById(`section-title-${focusId}`)?.focus();
    }
  }, [focusId, hasFocusTarget]);

  function choose(key: string) {
    const next = optionByKey(options, key);
    if (next) {
      actions.clearFeedback();
      setCreatedSection(null);
      update(optionToParams(next));
    }
  }

  async function confirmWithdraw() {
    if (!withdrawing) {
      return;
    }
    await actions.run(withdrawing.id, withdrawing.title, 'withdraw');
    setWithdrawing(null);
  }

  return (
    <PageContainer>
      <PageHeader
        context={shell.title}
        title="Planes de formación"
        description="Organiza los planes por área en secciones y módulos, y decide qué se publica."
      />
      <div className={styles.root}>
        <Select
          label="Plan de formación del área"
          value={option?.key ?? ''}
          options={options.map((item) => ({ value: item.key, label: item.label }))}
          onChange={(event) => choose(event.target.value)}
          help="Elige el área y crea o edita sus módulos: los verán los docentes que tengan esa área asignada. El plan General (inducción) lo ven todos."
        />
        <Notice tone="info">
          Los cambios se ven de inmediato en la ruta de los docentes. Los módulos que quitas del
          plan se pueden restaurar y el progreso de los docentes no se pierde.
        </Notice>

        {actions.feedback ? (
          <Notice
            tone={actions.feedback.tone}
            title={actions.feedback.tone === 'error' ? 'No se pudo completar la acción' : undefined}
          >
            {actions.feedback.text}
          </Notice>
        ) : null}
        {createdSection ? (
          <Notice tone="success">
            {`Sección «${createdSection.title}» creada al final del plan. Agrégale un módulo con su botón «Nuevo módulo».`}
          </Notice>
        ) : null}
        {viewData?.trackingError ? (
          <Notice tone="warning" title="No pudimos cargar el avance de los docentes">
            La lista se muestra sin los totales de «terminados» y «en curso».{' '}
            {viewData.trackingError.message}
          </Notice>
        ) : null}

        {option === null ? (
          <Notice tone="warning" title="Aún no hay áreas ni planes">
            Cuando el colegio tenga áreas registradas podrás crear aquí sus módulos de formación.
          </Notice>
        ) : view.state.status === 'loading' ? (
          <Loading>Cargando el plan…</Loading>
        ) : view.state.status === 'error' ? (
          <LoadError
            error={view.state.error}
            title="No pudimos cargar el plan"
            onRetry={view.reload}
          />
        ) : option.plan === null ? (
          <EmptyState
            icon="plan"
            title={`${option.area?.name ?? 'Esta área'} todavía no tiene plan de formación`}
            action={
              <Button startIcon="mas" onClick={() => setCreating({ section: null })}>
                Nuevo módulo
              </Button>
            }
          >
            Crea el primer módulo: nace en borrador y los docentes lo verán cuando lo publiques.
          </EmptyState>
        ) : (
          viewData && (
            <div className={styles.groups}>
              {groups.length === 0 ? (
                <EmptyState icon="plan" title="Este plan todavía no tiene secciones">
                  Crea la primera sección para organizar sus módulos.
                </EmptyState>
              ) : null}
              {groups.map((group) => (
                <section
                  key={group.section.id}
                  className={styles.group}
                  aria-labelledby={`section-title-${group.section.id}`}
                >
                  <header className={styles.groupHeader}>
                    <div className={styles.groupText}>
                      <h2
                        id={`section-title-${group.section.id}`}
                        tabIndex={-1}
                        className={styles.groupTitle}
                      >
                        {group.section.title}
                      </h2>
                      {group.section.subtitle ? (
                        <p className={styles.groupSubtitle}>{group.section.subtitle}</p>
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      startIcon="mas"
                      context={`en la sección ${group.section.title}`}
                      onClick={() =>
                        setCreating({
                          section: { id: group.section.id, title: group.section.title },
                        })
                      }
                    >
                      Nuevo módulo
                    </Button>
                  </header>
                  {group.modules.length === 0 ? (
                    <p className={styles.sectionEmpty}>
                      Esta sección está vacía. Los docentes no la ven hasta que tenga un módulo
                      publicado.
                    </p>
                  ) : null}
                  <div className={styles.modules}>
                    {group.modules.map((module) => (
                      <ModuleRow
                        key={module.id}
                        module={module}
                        planId={viewData.tree.plan.id}
                        totals={totals.get(module.id) ?? null}
                        teacherCount={tracking?.teachers.length ?? 0}
                        busy={actions.busyId === module.id}
                        onPublish={() =>
                          void actions.run(module.id, moduleTitleWithNumber(module), 'publish')
                        }
                        onRestore={() =>
                          void actions.run(module.id, moduleTitleWithNumber(module), 'restore')
                        }
                        onAskWithdraw={() =>
                          setWithdrawing({ id: module.id, title: moduleTitleWithNumber(module) })
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
              <button
                type="button"
                className={styles.newSection}
                onClick={() => setCreatingSection(true)}
              >
                <Icon name="mas" size={18} />
                Crear nueva sección
              </button>
            </div>
          )
        )}
      </div>

      {creating && option ? (
        <NewModuleDialog
          option={option}
          section={creating.section}
          tree={viewData?.tree ?? null}
          onClose={() => setCreating(null)}
          onPartial={reloadCatalog}
          onCreated={(created) => {
            setCreating(null);
            router.push(`${shell.path}/planes/modulos/${created.moduleId}`);
          }}
        />
      ) : null}
      {creatingSection && viewData ? (
        <NewSectionDialog
          planId={viewData.tree.plan.id}
          existingTitles={viewData.tree.sections.map((item) => item.title)}
          onClose={() => setCreatingSection(false)}
          onCreated={(section) => {
            setCreatingSection(false);
            setCreatedSection({ id: section.id, title: section.title });
            void view.refresh();
          }}
        />
      ) : null}
      {withdrawing ? (
        <ModuleActionDialog
          confirmation={withdrawConfirmation(withdrawing.title)}
          busy={actions.busyId === withdrawing.id}
          onClose={() => setWithdrawing(null)}
          onConfirm={() => void confirmWithdraw()}
        />
      ) : null}
    </PageContainer>
  );
}

/** «Planes de formación» (`/coordinacion/planes`): lista por sección con acciones según el estado. */
export function PlansScreen() {
  const catalog = usePlansCatalog();

  if (catalog.state.status === 'loading') {
    return (
      <PageContainer>
        <Loading>Cargando los planes de formación…</Loading>
      </PageContainer>
    );
  }
  if (catalog.state.status === 'error') {
    return (
      <PageContainer>
        <LoadError
          error={catalog.state.error}
          title="No pudimos cargar los planes"
          onRetry={catalog.reload}
        />
      </PageContainer>
    );
  }
  return <PlansView catalog={catalog.state.data} reloadCatalog={() => void catalog.refresh()} />;
}
