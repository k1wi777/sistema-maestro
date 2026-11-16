'use client';

import { TrainingModuleStatus } from '@gns/shared';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ApiError } from '@/shared/api';
import { LoadError, Loading, useQueryParams } from '@/shared/data';
import {
  ActionBar,
  Button,
  ButtonLink,
  Notice,
  PageContainer,
  PageHeader,
  StatusBadge,
  Stepper,
  type StepperStep,
} from '@/shared/ui';

import { useModuleEditor, useModuleEditorData, type EditorData } from '../hooks/use-module-editor';
import {
  EDITOR_STEP_IDS,
  EDITOR_STEP_TITLE,
  editorSteps,
  isEditorStepId,
  publishability,
  type EditorStepId,
} from '../model/editor-steps';
import { MODULE_STATUS_INFO, moduleTitleWithNumber } from '../model/labels';
import styles from './module-editor-screen.module.css';
import { ActivitiesStep } from './steps/activities-step';
import { ChallengeStep } from './steps/challenge-step';
import { DataStep } from './steps/data-step';
import { PresentationStep } from './steps/presentation-step';
import { PreviewStep } from './steps/preview-step';
import { VideoStep } from './steps/video-step';

const PLANS_PATH = '/coordinacion/planes';
const PUBLISH_HELP_ID = 'module-publish-help';

function saveText(state: ReturnType<typeof useModuleEditor>['saveState'], dirty: boolean): string {
  if (state === 'saving') {
    return 'Guardando…';
  }
  if (state === 'error') {
    return 'No se pudo guardar';
  }
  if (dirty) {
    return 'Cambios sin guardar';
  }
  return state === 'saved' ? 'Guardado' : 'Sin cambios';
}

function NotFound({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  if (error.statusCode === 404) {
    return (
      <Notice tone="warning" title="No encontramos este módulo">
        Puede que el enlace sea incorrecto.{' '}
        <ButtonLink href={PLANS_PATH} variant="outline" size="sm">
          Ir a Planes de formación
        </ButtonLink>
      </Notice>
    );
  }
  return <LoadError error={error} onRetry={onRetry} />;
}

function EditorBody({ initial }: { initial: EditorData }) {
  const editor = useModuleEditor(initial);
  const { detail, tree } = editor;
  const { params, update } = useQueryParams();
  const panelRef = useRef<HTMLDivElement>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const stepParam = params.get('paso');
  const current: EditorStepId = isEditorStepId(stepParam) ? stepParam : EDITOR_STEP_IDS[0];
  const stepIndex = EDITOR_STEP_IDS.indexOf(current);
  const previous = EDITOR_STEP_IDS[stepIndex - 1];
  const next = EDITOR_STEP_IDS[stepIndex + 1];

  const views = useMemo(() => editorSteps(detail), [detail]);
  const gate = useMemo(() => publishability(detail), [detail]);
  const isDraft = detail.status === TrainingModuleStatus.Draft;
  const status = MODULE_STATUS_INFO[detail.status];
  const isGeneral = tree.plan.areaId === null;
  const sectionTitle = tree.sections.find((section) => section.id === detail.sectionId)?.title;

  // Al cambiar de paso el foco pasa al panel para que el lector de pantalla anuncie el nuevo paso.
  const previousStep = useRef(current);
  useEffect(() => {
    if (previousStep.current !== current) {
      previousStep.current = current;
      panelRef.current?.focus();
    }
  }, [current]);

  function focusFirstError() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panelRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
    });
  }

  /** Guarda el paso que se deja y solo navega si el guardado terminó bien (R8). */
  async function goToStep(id: string) {
    if (!isEditorStepId(id) || id === current || editor.busy) {
      return;
    }
    if (await editor.saveStep(current)) {
      update({ paso: id });
    } else {
      focusFirstError();
    }
  }

  async function handleSave() {
    if (!(await editor.saveStep(current))) {
      focusFirstError();
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    setPublished(false);
    if (await editor.saveStep(current)) {
      const result = await editor.publish();
      setPublished(result.ok);
      setPublishError(result.message);
    } else {
      focusFirstError();
    }
    setPublishing(false);
  }

  const stepperSteps: StepperStep[] = views.map((view) => ({
    id: view.id,
    title: view.title,
    hint: view.hint,
    state: view.state,
  }));

  function renderStep(id: EditorStepId) {
    const props = { editor, number: EDITOR_STEP_IDS.indexOf(id) + 1 };
    switch (id) {
      case 'datos':
        return <DataStep {...props} isGeneral={isGeneral} />;
      case 'video':
        return <VideoStep {...props} />;
      case 'desafio':
        return <ChallengeStep {...props} />;
      case 'presentacion':
        return <PresentationStep {...props} />;
      case 'actividades':
        return <ActivitiesStep {...props} />;
      case 'vista-previa':
        return <PreviewStep {...props} />;
    }
  }

  const description = [tree.plan.name, isGeneral ? sectionTitle : undefined]
    .filter(Boolean)
    .join(' · ');

  return (
    <PageContainer>
      <div className={styles.screen}>
        <div className={styles.back}>
          <ButtonLink
            href={`${PLANS_PATH}?plan=${detail.planId}`}
            variant="outline"
            size="sm"
            startIcon="volver"
          >
            Planes de formación
          </ButtonLink>
        </div>
        <PageHeader
          context="Editor de módulo"
          title={moduleTitleWithNumber(detail)}
          description={description}
          actions={
            <>
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              {isDraft ? (
                <Button
                  startIcon="enviar"
                  disabled={!gate.publishable || publishing || editor.busy}
                  aria-describedby={PUBLISH_HELP_ID}
                  onClick={() => void handlePublish()}
                >
                  {publishing ? 'Publicando…' : 'Publicar'}
                </Button>
              ) : null}
            </>
          }
        />

        <div className={styles.notices}>
          {isDraft ? (
            <Notice tone={gate.publishable ? 'info' : 'warning'}>
              <span id={PUBLISH_HELP_ID}>
                Cada contenido es opcional, pero el módulo necesita al menos uno para publicarse.
                {gate.missing ? ` ${gate.missing}` : ''}
              </span>
            </Notice>
          ) : null}
          {published ? (
            <Notice tone="success">
              El módulo está publicado: los docentes del plan ya lo ven en su ruta.
            </Notice>
          ) : null}
          {detail.status === TrainingModuleStatus.OutOfPlan ? (
            <Notice tone="warning">
              Este módulo está fuera del plan y los docentes no lo ven. Restáuralo desde «Planes de
              formación».
            </Notice>
          ) : null}
          {publishError ? (
            <Notice tone="error" title="No se pudo publicar">
              {publishError}
            </Notice>
          ) : null}
          {editor.saveError ? (
            <Notice tone="error" title="No se pudo guardar">
              <p className={styles.noticeText}>
                {editor.saveError} Lo que escribiste se conserva en esta pantalla.
              </p>
              <p className={styles.noticeAction}>
                <Button variant="outline" size="sm" onClick={() => void handleSave()}>
                  Reintentar
                </Button>
              </p>
            </Notice>
          ) : null}
        </div>

        <Stepper
          label="Pasos del módulo"
          steps={stepperSteps}
          currentId={current}
          onStepChange={(id) => void goToStep(id)}
          saveState={editor.saveState}
          className={styles.stepper}
        />

        <div ref={panelRef} tabIndex={-1} className={styles.panel}>
          {renderStep(current)}
        </div>

        <ActionBar
          className={styles.actionBar}
          status={
            <span className={styles.saveStatus} data-badge={editor.saveState}>
              {saveText(editor.saveState, editor.dirty)}
            </span>
          }
        >
          <Button
            variant="outline"
            startIcon="volver"
            className={styles.compact}
            disabled={!previous || editor.busy}
            onClick={() => previous && void goToStep(previous)}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            startIcon="guardar"
            className={styles.compact}
            disabled={editor.saveState === 'saving' || editor.busy}
            onClick={() => void handleSave()}
          >
            Guardar cambios
          </Button>
          {next ? (
            <Button endIcon="siguiente" disabled={editor.busy} onClick={() => void goToStep(next)}>
              Siguiente
              <span className={styles.nextName}>{`: ${EDITOR_STEP_TITLE[next]}`}</span>
            </Button>
          ) : null}
        </ActionBar>
      </div>
    </PageContainer>
  );
}

/** Editor por pasos de un módulo (`/coordinacion/planes/modulos/[id]`). */
export function ModuleEditorScreen({ id }: { id: string }) {
  const remote = useModuleEditorData(id);

  if (remote.state.status === 'loading') {
    return (
      <PageContainer>
        <Loading>Cargando el módulo…</Loading>
      </PageContainer>
    );
  }
  if (remote.state.status === 'error') {
    return (
      <PageContainer>
        <NotFound error={remote.state.error} onRetry={remote.reload} />
      </PageContainer>
    );
  }
  return <EditorBody initial={remote.state.data} />;
}
