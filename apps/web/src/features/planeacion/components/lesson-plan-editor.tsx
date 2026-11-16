'use client';

import {
  RecordStatus,
  lessonPlanAreasLabel,
  type LessonPlan,
  type Review,
  type SharedActivity,
} from '@gns/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ApiError } from '@/shared/api';
import { formatTime } from '@/shared/format/dates';
import {
  ActionBar,
  ActionMenu,
  Button,
  ButtonLink,
  Notice,
  PageContainer,
  PageHeader,
  StatusBadge,
  Stepper,
  type StepperStep,
} from '@/shared/ui';

import { useLessonPlan } from '../hooks/use-lesson-plan';
import { useLessonPlanEditor } from '../hooks/use-lesson-plan-editor';
import { useQueryParams } from '@/shared/data';
import { useTeachingContext } from '../hooks/use-teaching-context';
import { appendToMoment, planToActivityDraft } from '../model/activity-mapping';
import { latestFeedback } from '../model/coordination-feedback';
import type { FormErrors } from '../model/form-state';
import { printTitle } from '../model/print';
import { readOnlyNotice } from '../model/read-only-notice';
import { buildReviewSummary } from '../model/review-summary';
import {
  CONTENT_STEPS,
  FIRST_STEP,
  STEPS,
  isStepId,
  neighbourStep,
  stepById,
  stepOfFormField,
  stepState,
  MOMENTS,
  type MomentField,
  type StepId,
} from '../model/steps';
import { CommunityIdeas, type IdeaUseResult } from './community-ideas';
import { CoordinationFeedbackNotice } from './coordination-feedback';
import { LessonPlanPrint } from './lesson-plan-print';
import { LoadError, Loading } from '@/shared/data';
import styles from './lesson-plan-editor.module.css';
import { DigitalStep } from './steps/digital-step';
import { GeneralStep } from './steps/general-step';
import { ShareActivityDialog, type ShareActivityMode } from './share-activity-dialog';
import { MomentsStep, type MomentFocusRequest } from './steps/moments-step';
import { PerformanceStep } from './steps/performance-step';
import { ResourcesStep } from './steps/resources-step';
import { ReviewStep } from './steps/review-step';
import { SubmitDialog } from './submit-dialog';
import { STATUS_INFO, VoidRecordDialog, canVoid, printWithTitle } from '@/shared/records';
import { PLANNING_PATH } from '../model/paths';

const CONFLICT_MESSAGE =
  'La planeación cambió de estado en el servidor, así que se recargó con su estado actual.';

type SaveBadge = 'saving' | 'error' | 'dirty' | 'saved' | 'clean';

function saveText(badge: SaveBadge, savedAt: Date | null): string {
  switch (badge) {
    case 'saving':
      return 'Guardando…';
    case 'error':
      return 'No se pudo guardar';
    case 'dirty':
      return 'Cambios sin guardar';
    case 'saved':
      return savedAt ? `Guardado · ${formatTime(savedAt)}` : 'Guardado';
    default:
      return 'Sin cambios';
  }
}

function NotFound({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  if (error.statusCode === 404) {
    return (
      <Notice tone="warning" title="No encontramos esta planeación">
        Puede que se haya anulado o que no sea tuya.{' '}
        <ButtonLink href={PLANNING_PATH} variant="outline" size="sm">
          Ir a Mis planeaciones
        </ButtonLink>
      </Notice>
    );
  }
  return <LoadError error={error} onRetry={onRetry} />;
}

interface EditorScreenProps {
  initial: LessonPlan;
  reviews: Review[];
  notice: string | null;
  onConflict: () => void;
}

function EditorScreen({ initial, reviews, notice, onConflict }: EditorScreenProps) {
  const editor = useLessonPlanEditor({ initial, onConflict });
  const { plan, draft, errors, editable } = editor;
  const teaching = useTeachingContext();
  const { params, update } = useQueryParams();
  const panelRef = useRef<HTMLDivElement>(null);

  const [success, setSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [shareMode, setShareMode] = useState<ShareActivityMode | null>(null);
  const [focusRequest, setFocusRequest] = useState<MomentFocusRequest | null>(null);

  const showFeedback =
    plan.status === RecordStatus.ChangesRequested || plan.status === RecordStatus.Reviewed;
  const feedback = useMemo(
    () => (showFeedback ? latestFeedback(reviews) : null),
    [reviews, showFeedback],
  );
  const adjusted = useMemo(() => new Set(feedback?.adjustedFields ?? []), [feedback]);
  const linkCount = plan.linkedResources.length;

  const summary = useMemo(
    () =>
      buildReviewSummary(draft, {
        gradeName: plan.grade.name,
        areaNames: lessonPlanAreasLabel(plan.areas),
        periodNumber: plan.period.number,
        linkCount,
        adjusted,
      }),
    [draft, plan.grade.name, plan.areas, plan.period.number, linkCount, adjusted],
  );

  const stepStates = useMemo(
    () =>
      STEPS.map((step) => ({
        step,
        state: stepState(step, draft, adjusted, linkCount),
      })),
    [draft, adjusted, linkCount],
  );

  // El paso inicial se decide una sola vez: si siguiera al contenido, saltaría mientras se escribe.
  const [defaultStep] = useState<StepId>(() => {
    if (!editable) {
      return FIRST_STEP;
    }
    const pending = stepStates.find(
      ({ step, state }) => step.id !== 'revisar' && state !== 'done' && state !== 'adjusted',
    );
    return pending ? pending.step.id : 'revisar';
  });
  const stepParam = params.get('paso');
  const current: StepId = isStepId(stepParam) ? stepParam : defaultStep;
  const whole = params.get('vista') === 'todo';

  // Al cambiar de paso el foco pasa al panel para que el lector de pantalla anuncie el nuevo paso.
  const previousStep = useRef(current);
  useEffect(() => {
    if (previousStep.current !== current) {
      previousStep.current = current;
      panelRef.current?.focus();
    }
  }, [current]);

  const focusFirstError = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panelRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
    });
  }, []);

  /** Lleva al paso y al campo del primer error, si lo hay. */
  const revealErrors = useCallback(
    (found: FormErrors) => {
      const field = Object.keys(found)[0];
      if (!field) {
        return;
      }
      const stepId = stepOfFormField(field);
      if (stepId && !whole && stepId !== current) {
        update({ paso: stepId });
      }
      focusFirstError();
    },
    [current, focusFirstError, update, whole],
  );

  function goToStep(id: string) {
    if (!isStepId(id)) {
      return;
    }
    void editor.save();
    update({ paso: id, vista: null });
  }

  async function handleSave() {
    const outcome = await editor.save();
    if (!outcome.ok) {
      revealErrors(outcome.errors);
    }
  }

  async function handleConfirmSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    const outcome = await editor.submit();
    setSubmitting(false);
    setSubmitOpen(false);
    if (outcome.ok) {
      setSuccess('Planeación enviada a coordinación. Aquí verás su respuesta cuando la revisen.');
      window.scrollTo({ top: 0 });
      return;
    }
    if (outcome.message) {
      setSubmitError(outcome.message);
    }
    revealErrors(outcome.errors);
  }

  async function handleVoid(reason: string): Promise<string | null> {
    const result = await editor.voidPlan(reason);
    if (!result.ok) {
      return result.error.message;
    }
    setVoidOpen(false);
    setSuccess('Planeación anulada. Queda constancia del motivo.');
    window.scrollTo({ top: 0 });
    return null;
  }

  /** Agrega una idea de la comunidad al final de un momento sin borrar lo escrito (R26). */
  function handleUseIdea(field: MomentField, activity: SharedActivity): IdeaUseResult {
    const appended = appendToMoment(draft, field, activity);
    if (!appended.ok) {
      return { ok: false, message: appended.message };
    }
    editor.setField(field, appended.values[field]);
    setFocusRequest({ field, nonce: Date.now() });
    const number = MOMENTS.find((moment) => moment.field === field)?.number;
    return { ok: true, message: `Agregada al Momento ${number}.` };
  }

  /** Guarda lo pendiente y abre el formulario de compartir precargado (nunca con el D.U.A). */
  async function handleShare() {
    const outcome = await editor.save();
    if (!outcome.ok) {
      revealErrors(outcome.errors);
      return;
    }
    const saved = editor.getPlan();
    const { values, clipped } = planToActivityDraft(saved);
    setShareMode({
      kind: 'create',
      initial: { ...values, levelId: saved.level.id },
      notes: [
        'El D.U.A y los recursos digitales no se copian.',
        ...(saved.areas.length > 1
          ? [
              `Esta planeación trabaja varias áreas (${lessonPlanAreasLabel(saved.areas)}): la actividad se publica con una sola; revisa la que se propone en «Dimensión o asignatura».`,
            ]
          : []),
        ...(clipped.length > 0
          ? ['Algunos textos superaban el máximo de una actividad y se recortaron: revísalos.']
          : []),
      ],
    });
  }

  const next = neighbourStep(current, 1);
  const previous = neighbourStep(current, -1);
  const info = STATUS_INFO[plan.status];
  const readOnly = !editable;
  const readOnlyMessage = readOnlyNotice(plan.status);
  const title = `${lessonPlanAreasLabel(plan.areas)} · ${plan.topic?.trim() || 'Sin tema'}`;
  const badge: SaveBadge =
    editor.saveState === 'saving'
      ? 'saving'
      : editor.saveState === 'error'
        ? 'error'
        : editor.dirty
          ? 'dirty'
          : editor.savedAt
            ? 'saved'
            : 'clean';
  const linkWarning = params.get('aviso') === 'enlace' ? params.get('enlace') : null;

  const stepperSteps: StepperStep[] = stepStates.map(({ step, state }) => ({
    id: step.id,
    title: step.title,
    state: step.id === 'revisar' ? (editable ? 'pending' : 'done') : state,
  }));

  const stepProps = {
    plan,
    draft,
    errors,
    readOnly,
    onChange: editor.setField,
  };

  function renderStep(id: StepId) {
    const number = STEPS.findIndex((step) => step.id === id) + 1;
    switch (id) {
      case 'datos':
        return (
          <GeneralStep
            {...stepProps}
            number={number}
            periods={teaching.state.status === 'ready' ? teaching.state.data.periods : null}
            areaOptions={
              teaching.state.status === 'ready'
                ? (teaching.state.data.grades.find((entry) => entry.grade.id === plan.grade.id)
                    ?.areas ?? [])
                : null
            }
          />
        );
      case 'desempeno':
        return <PerformanceStep {...stepProps} number={number} />;
      case 'momentos':
        return (
          <MomentsStep
            {...stepProps}
            number={number}
            focusRequest={focusRequest}
            ideas={
              editable ? (
                <CommunityIdeas key={plan.learningCorner ?? ''} plan={plan} onUse={handleUseIdea} />
              ) : undefined
            }
          />
        );
      case 'recursos':
        return <ResourcesStep {...stepProps} number={number} />;
      case 'digitales':
        return (
          <DigitalStep
            plan={plan}
            readOnly={readOnly}
            number={number}
            onAdd={editor.addResource}
            onRemove={editor.removeResource}
          />
        );
      case 'revisar':
        return (
          <ReviewStep
            summary={summary}
            readOnly={readOnly}
            number={number}
            onGoToStep={goToStep}
            onSubmit={() => setSubmitOpen(true)}
          />
        );
    }
  }

  const menuItems = [
    whole
      ? {
          id: 'steps',
          label: 'Ver por pasos',
          icon: 'capas' as const,
          onSelect: () => update({ vista: null }),
        }
      : {
          id: 'all',
          label: 'Ver todo el formulario',
          icon: 'capas' as const,
          onSelect: () => {
            void editor.save();
            update({ vista: 'todo', paso: null });
          },
        },
    {
      id: 'share',
      label: 'Compartir con la comunidad',
      icon: 'gente' as const,
      onSelect: () => void handleShare(),
    },
    {
      id: 'pdf',
      label: 'Exportar PDF',
      icon: 'bajar' as const,
      onSelect: () => printWithTitle(printTitle(plan)),
    },
    ...(canVoid(plan.status)
      ? [
          {
            id: 'void',
            label: 'Anular',
            icon: 'anular' as const,
            onSelect: () => setVoidOpen(true),
          },
        ]
      : []),
  ];

  const isLast = current === 'revisar';

  return (
    <PageContainer>
      <div className={styles.screen}>
        <div className={styles.back}>
          <ButtonLink href={PLANNING_PATH} variant="outline" size="sm" startIcon="volver">
            Mis planeaciones
          </ButtonLink>
        </div>
        <PageHeader
          context="Planeación GNS"
          title={title}
          actions={<StatusBadge tone={info.tone}>{info.label}</StatusBadge>}
        />

        <div className={styles.notices}>
          {notice ? <Notice tone="warning">{notice}</Notice> : null}
          {success ? <Notice tone="success">{success}</Notice> : null}
          {submitError ? <Notice tone="error">{submitError}</Notice> : null}
          {linkWarning ? (
            <Notice tone="warning" title="No se pudo agregar el enlace de la actividad">
              Agrégalo a mano en «Recursos digitales»: {linkWarning}
            </Notice>
          ) : null}
          {readOnlyMessage ? (
            <Notice tone={readOnlyMessage.tone}>{readOnlyMessage.text}</Notice>
          ) : null}
          {feedback ? <CoordinationFeedbackNotice feedback={feedback} /> : null}
          {editor.saveError ? (
            <Notice tone="error" title="No se pudo guardar">
              <p className={styles.noticeText}>
                {editor.saveError} Lo que escribiste se conserva en esta pantalla.
              </p>
              {editable ? (
                <p className={styles.noticeAction}>
                  <Button variant="outline" size="sm" onClick={() => void handleSave()}>
                    Reintentar
                  </Button>
                </p>
              ) : null}
            </Notice>
          ) : null}
        </div>

        {whole ? (
          <div className={styles.wholeHeader}>
            <Button
              variant="outline"
              size="sm"
              startIcon="volver"
              onClick={() => update({ vista: null })}
            >
              Volver a los pasos
            </Button>
          </div>
        ) : (
          <Stepper
            label="Pasos de la planeación"
            steps={stepperSteps}
            currentId={current}
            onStepChange={goToStep}
            saveState={editor.saveState}
            className={styles.stepper}
          />
        )}

        <div ref={panelRef} tabIndex={-1} className={styles.panel}>
          {whole ? (
            <div className={styles.whole}>
              {CONTENT_STEPS.map((step) => (
                <div key={step.id}>{renderStep(step.id)}</div>
              ))}
              <div className={styles.wholeFooter}>
                <Button
                  endIcon="siguiente"
                  onClick={() => update({ vista: null, paso: 'revisar' })}
                >
                  Revisar y enviar
                </Button>
              </div>
            </div>
          ) : (
            renderStep(current)
          )}
        </div>

        <ActionBar
          className={styles.actionBar}
          status={
            <span
              aria-live={whole ? 'polite' : 'off'}
              className={styles.saveStatus}
              data-badge={badge}
            >
              {saveText(badge, editor.savedAt)}
            </span>
          }
        >
          <ActionMenu
            label="Más"
            ariaLabel="Más acciones"
            icon="puntos"
            placement="up"
            collapseLabel
            items={menuItems}
          />
          {whole ? null : (
            <Button
              variant="outline"
              startIcon="volver"
              className={styles.compact}
              disabled={!previous}
              onClick={() => previous && goToStep(previous.id)}
            >
              Anterior
            </Button>
          )}
          {editable ? (
            <Button
              variant="outline"
              startIcon="guardar"
              className={styles.compact}
              disabled={editor.saveState === 'saving'}
              onClick={() => void handleSave()}
            >
              Guardar
            </Button>
          ) : null}
          {whole ? (
            editable ? (
              <Button endIcon="siguiente" onClick={() => update({ vista: null, paso: 'revisar' })}>
                Revisar y enviar
              </Button>
            ) : null
          ) : isLast ? (
            editable ? (
              <Button
                endIcon="enviar"
                disabled={summary.blockedReason !== null}
                onClick={() => setSubmitOpen(true)}
              >
                Enviar a coordinación
              </Button>
            ) : null
          ) : (
            <Button endIcon="siguiente" onClick={() => next && goToStep(next.id)}>
              Siguiente
              <span className={styles.nextName}>{`: ${next ? stepById(next.id).title : ''}`}</span>
            </Button>
          )}
        </ActionBar>
      </div>

      <LessonPlanPrint plan={plan} />

      {submitOpen ? (
        <SubmitDialog
          busy={submitting}
          onClose={() => setSubmitOpen(false)}
          onConfirm={() => void handleConfirmSubmit()}
        />
      ) : null}
      {shareMode ? (
        <ShareActivityDialog
          mode={shareMode}
          onClose={() => setShareMode(null)}
          onSaved={(activity) => {
            setShareMode(null);
            if (activity) {
              setSuccess(`Publicaste «${activity.title}» en el repositorio de la comunidad.`);
            }
          }}
        />
      ) : null}
      {voidOpen ? (
        <VoidRecordDialog
          title="Anular planeación"
          description="La planeación queda anulada y no se puede editar; coordinación conserva la constancia."
          confirmLabel="Anular planeación"
          onClose={() => setVoidOpen(false)}
          onConfirm={handleVoid}
        />
      ) : null}
    </PageContainer>
  );
}

/** Editor por pasos de una planeación (`/docente/formatos/planeacion/[id]`). */
export function LessonPlanEditor({ id }: { id: string }) {
  const remote = useLessonPlan(id);
  const [notice, setNotice] = useState<string | null>(null);
  const { reload } = remote;

  const handleConflict = useCallback(() => {
    setNotice(CONFLICT_MESSAGE);
    reload();
  }, [reload]);

  if (remote.state.status === 'loading') {
    return (
      <PageContainer>
        <Loading>Cargando la planeación…</Loading>
      </PageContainer>
    );
  }
  if (remote.state.status === 'error') {
    return (
      <PageContainer>
        <NotFound error={remote.state.error} onRetry={reload} />
      </PageContainer>
    );
  }
  return (
    <EditorScreen
      initial={remote.state.data.plan}
      reviews={remote.state.data.reviews}
      notice={notice}
      onConflict={handleConflict}
    />
  );
}
