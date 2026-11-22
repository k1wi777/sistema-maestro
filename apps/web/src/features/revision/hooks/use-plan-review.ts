'use client';

import {
  ApiErrorCode,
  RecordStatus,
  approveLessonPlanSchema,
  returnLessonPlanSchema,
  type LessonPlan,
  type Review,
} from '@gns/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useReducer, useRef, useState } from 'react';

import { NETWORK_ERROR_CODE, type ApiError, type ApiResult } from '@/shared/api';
import { useRemote, type Remote } from '@/shared/data';
import {
  canReviewGrade,
  consultNotice,
  coordinatorOfGrade,
  type GradeCoordinator,
} from '@/shared/records';
import { useSession } from '@/shared/session';

import { listGrades } from '../api/catalogs';
import {
  approvePlan,
  getPlan,
  listPlanReviews,
  listPlans,
  returnPlan,
  voidPlan,
  type ApprovePlanBody,
} from '../api/lesson-plans';
import {
  buildChanges,
  isAdjusted,
  validateAdjustment,
  type PlanAdjustments,
} from '../model/adjustments';
import { adjustedBlockDates, buildHistory } from '../model/history';
import {
  CONFLICT_MESSAGE,
  DRAFT_DISCARDED_MESSAGES,
  DRAFT_RESTORED_MESSAGE,
  DRAFT_SAVED_MESSAGE,
  SELF_REVIEW_MESSAGE,
  readOnlyReason,
  sentence,
} from '../model/messages';
import {
  blockOfChangesError,
  reviewableBlocks,
  type BlockKey,
  type PlanBlock,
} from '../model/plan-blocks';
import { nextPendingPlan } from '../model/queue';
import {
  commentExcess,
  composeReviewComment,
  type BlockObservations,
} from '../model/review-comment';
import {
  DRAFT_VERSION,
  draftKey,
  isEmptyDraft,
  restoreDraft,
  serializeDraft,
} from '../model/review-draft';
import { findResubmission } from '../model/resubmission';
import { useRevisionPaths } from './use-revision-paths';

export interface PlanWithReviews {
  plan: LessonPlan;
  reviews: Review[];
  /** Coordinadora del grado de la planeación (quien la revisa) o `null`. */
  coordinator: GradeCoordinator | null;
}

async function loadPlan(id: string): Promise<ApiResult<PlanWithReviews>> {
  const [plan, reviews, grades] = await Promise.all([
    getPlan(id),
    listPlanReviews(id),
    listGrades(),
  ]);
  if (!plan.ok) {
    return plan;
  }
  if (!reviews.ok) {
    return reviews;
  }
  if (!grades.ok) {
    return grades;
  }
  return {
    ok: true,
    data: {
      plan: plan.data,
      reviews: reviews.data,
      coordinator: coordinatorOfGrade(grades.data, plan.data.grade.id),
    },
  };
}

/** Una planeación con su historial de revisión. */
export function usePlanReviewData(id: string): Remote<PlanWithReviews> {
  return useRemote(() => loadPlan(id), `plan-review:${id}`);
}

interface ReviewState {
  adjustments: PlanAdjustments;
  observations: BlockObservations;
  general: string;
  /** Bloque en edición («Ajustar»). */
  editing: BlockKey | null;
}

type ReviewAction =
  | { type: 'set-adjustment'; values: PlanAdjustments }
  | { type: 'remove-adjustment'; fields: readonly (keyof PlanAdjustments)[] }
  | { type: 'edit'; block: BlockKey | null }
  | { type: 'set-observation'; block: BlockKey; text: string }
  | { type: 'set-general'; text: string }
  | { type: 'reset' };

const EMPTY: ReviewState = { adjustments: {}, observations: {}, general: '', editing: null };

function reduce(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case 'set-adjustment':
      return { ...state, adjustments: { ...state.adjustments, ...action.values }, editing: null };
    case 'remove-adjustment': {
      const adjustments = { ...state.adjustments };
      for (const field of action.fields) {
        delete adjustments[field];
      }
      return { ...state, adjustments };
    }
    case 'edit':
      return { ...state, editing: action.block };
    case 'set-observation':
      return { ...state, observations: { ...state.observations, [action.block]: action.text } };
    case 'set-general':
      return { ...state, general: action.text };
    case 'reset':
      return EMPTY;
  }
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): boolean {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
    return true;
  } catch {
    return false;
  }
}

export interface ReviewNotice {
  tone: 'success' | 'warning' | 'error' | 'info';
  text: string;
  /** Ofrece «Reintentar» (fallo de red al decidir). */
  retryable?: boolean;
}

export type Busy = 'approve' | 'return' | 'void' | null;

const QUEUE_SIZE = 20;

interface UsePlanReviewOptions {
  plan: LessonPlan;
  reviews: Review[];
  coordinator: GradeCoordinator | null;
  /** Vuelve a pedir la planeación y su historial sin pasar por la carga (conserva lo escrito). */
  refresh: () => Promise<ApiError | null>;
  /** Filtros de la bandeja de la que se vino, como query string. */
  backQuery: string;
}

/** Estado y acciones de la revisión de una planeación abierta por coordinación. */
export function usePlanReview({
  plan,
  reviews,
  coordinator,
  refresh,
  backQuery,
}: UsePlanReviewOptions) {
  const router = useRouter();
  const paths = useRevisionPaths();
  const { state: session } = useSession();
  const user = session.status === 'authenticated' ? session.user : null;
  // Solo la coordinadora del grado revisa: para el resto es «Solo consulta» y no hay borrador.
  const canReview = canReviewGrade(user, coordinator);
  const storageKey = user && canReview ? draftKey(user.id, plan.id) : null;

  const [initial] = useState<{ state: ReviewState; notice: ReviewNotice | null }>(() => {
    const restored = storageKey ? restoreDraft(readStorage(storageKey), plan) : null;
    if (restored?.kind === 'restored') {
      return {
        state: {
          adjustments: restored.draft.adjustments,
          observations: restored.draft.observations,
          general: restored.draft.general,
          editing: null,
        },
        notice: { tone: 'info', text: DRAFT_RESTORED_MESSAGE },
      };
    }
    if (restored?.kind === 'discarded' && storageKey) {
      writeStorage(storageKey, null);
      return {
        state: EMPTY,
        notice: { tone: 'warning', text: DRAFT_DISCARDED_MESSAGES[restored.reason] },
      };
    }
    return { state: EMPTY, notice: null };
  });
  const [state, dispatch] = useReducer(reduce, initial.state);
  const [notice, setNotice] = useState<ReviewNotice | null>(initial.notice);
  const [blockErrors, setBlockErrors] = useState<Partial<Record<BlockKey, string>>>({});
  const [lostComment, setLostComment] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const busyRef = useRef<Busy>(null);
  const lastDecision = useRef<'approve' | 'return'>('approve');

  const blocks = useMemo<PlanBlock[]>(() => reviewableBlocks(plan.level.name), [plan.level.name]);
  const own = user !== null && plan.teacher.id === user.id;
  const canDecide = canReview && plan.status === RecordStatus.Submitted && !own;
  const blockedReason = canReview ? readOnlyReason(plan.status, own) : null;
  const consultText = canReview
    ? null
    : consultNotice(user, coordinator, plan.grade.name, 'esta planeación');

  const changes = useMemo(() => buildChanges(plan, state.adjustments), [plan, state.adjustments]);
  const comment = useMemo(
    () => composeReviewComment(blocks, state.observations, state.general),
    [blocks, state.observations, state.general],
  );
  const excess = commentExcess(comment);
  const observationCount =
    blocks.filter((block) => (state.observations[block.key] ?? '').trim() !== '').length +
    (state.general.trim() ? 1 : 0);
  const adjustmentCount = blocks.filter((block) =>
    block.fields.some((field) => isAdjusted(plan, state.adjustments, field)),
  ).length;

  const history = useMemo(
    () => buildHistory(reviews, plan.submittedAt),
    [reviews, plan.submittedAt],
  );
  const adjustedDates = useMemo(() => adjustedBlockDates(reviews), [reviews]);
  const resubmission = useMemo(
    () => findResubmission(plan, reviews, blocks),
    [plan, reviews, blocks],
  );

  const clearDraft = useCallback(() => {
    if (storageKey) {
      writeStorage(storageKey, null);
    }
  }, [storageKey]);

  const edit = useCallback((block: BlockKey | null) => dispatch({ type: 'edit', block }), []);
  const setObservation = useCallback(
    (block: BlockKey, text: string) => dispatch({ type: 'set-observation', block, text }),
    [],
  );
  const setGeneral = useCallback((text: string) => dispatch({ type: 'set-general', text }), []);

  /** Valida y deja el ajuste del bloque como pendiente; devuelve el motivo si no es válido. */
  const saveAdjustment = useCallback(
    (block: PlanBlock, values: PlanAdjustments): string | null => {
      const problem = validateAdjustment(plan, state.adjustments, block, values);
      if (problem) {
        return problem;
      }
      dispatch({ type: 'set-adjustment', values });
      setBlockErrors((previous) => ({ ...previous, [block.key]: undefined }));
      setNotice(null);
      return null;
    },
    [plan, state.adjustments],
  );
  const removeAdjustment = useCallback(
    (block: PlanBlock) => dispatch({ type: 'remove-adjustment', fields: block.fields }),
    [],
  );

  const saveDraft = useCallback(() => {
    if (!storageKey) {
      return;
    }
    const draft = {
      version: DRAFT_VERSION,
      planUpdatedAt: plan.updatedAt.toISOString(),
      adjustments: state.adjustments,
      observations: state.observations,
      general: state.general,
      savedAt: new Date().toISOString(),
    } as const;
    if (isEmptyDraft(draft)) {
      writeStorage(storageKey, null);
      setNotice({ tone: 'info', text: 'No hay ajustes ni observaciones que guardar.' });
      return;
    }
    const saved = writeStorage(storageKey, serializeDraft(draft));
    setNotice(
      saved
        ? { tone: 'success', text: DRAFT_SAVED_MESSAGE }
        : {
            tone: 'error',
            text: 'Este navegador no permite guardar el borrador. Decide ahora o copia tus observaciones.',
          },
    );
  }, [plan.updatedAt, state.adjustments, state.general, state.observations, storageKey]);

  /** Traduce un rechazo de la API: conserva lo escrito y avisa según el motivo. */
  const fail = useCallback(
    (error: ApiError) => {
      if (error.statusCode === 409) {
        setLostComment(comment || null);
        setNotice({ tone: 'warning', text: CONFLICT_MESSAGE });
        void refresh();
        return;
      }
      if (error.code === ApiErrorCode.SelfReviewForbidden) {
        setNotice({ tone: 'error', text: SELF_REVIEW_MESSAGE });
        return;
      }
      if (error.statusCode === 400) {
        const errors: Partial<Record<BlockKey, string>> = {};
        const other: string[] = [];
        for (const item of 'errors' in error ? (error.errors ?? []) : []) {
          const block = blockOfChangesError(item.field);
          if (block) {
            errors[block] ??= sentence(item.reason);
          } else {
            other.push(sentence(item.reason));
          }
        }
        setBlockErrors(errors);
        setNotice({
          tone: 'error',
          text:
            Object.keys(errors).length > 0
              ? 'Revisa los ajustes marcados: la API no los aceptó.'
              : (other[0] ?? error.message),
        });
        return;
      }
      setNotice({
        tone: 'error',
        text: error.message,
        retryable: error.code === NETWORK_ERROR_CODE,
      });
    },
    [comment, refresh],
  );

  /** Cuerpo de la decisión validado con los esquemas de `@gns/shared`; `null` si algo no cabe. */
  const buildBody = useCallback(
    (kind: 'approve' | 'return'): ApprovePlanBody | null => {
      const candidate = {
        comment,
        ...(changes ? { changes } : {}),
      };
      const schema = kind === 'approve' ? approveLessonPlanSchema : returnLessonPlanSchema;
      const parsed = schema.safeParse(candidate);
      if (!parsed.success) {
        setNotice({
          tone: 'error',
          text:
            excess > 0
              ? `Las observaciones exceden el máximo en ${excess} caracteres: acórtalas para enviarlas.`
              : sentence(parsed.error.issues[0]?.message ?? 'Los datos no son válidos.'),
        });
        return null;
      }
      return {
        ...(parsed.data.comment ? { comment: parsed.data.comment } : {}),
        ...(changes ? { changes } : {}),
      };
    },
    [changes, comment, excess],
  );

  const run = useCallback(async (kind: Exclude<Busy, null>, task: () => Promise<void>) => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = kind;
    setBusy(kind);
    setNotice(null);
    setBlockErrors({});
    try {
      await task();
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  }, []);

  /** Aprueba con el comentario y los ajustes y abre la siguiente planeación enviada más antigua. */
  const approveAndNext = useCallback(async (): Promise<void> => {
    if (!canDecide || !user) {
      return;
    }
    const body = buildBody('approve');
    if (!body) {
      return;
    }
    lastDecision.current = 'approve';
    await run('approve', async () => {
      const result = await approvePlan(plan.id, body);
      if (!result.ok) {
        fail(result.error);
        return;
      }
      clearDraft();
      const queue = await listPlans({
        status: RecordStatus.Submitted,
        coordinatorId: user.id,
        sortBy: 'submittedAt',
        sortOrder: 'asc',
        page: 1,
        pageSize: QUEUE_SIZE,
      });
      const next = queue.ok ? nextPendingPlan(queue.data.items, plan.id, user.id) : null;
      const suffix = backQuery ? `?${backQuery}` : '';
      if (next) {
        router.push(`${paths.plans}/${next.id}${suffix}`);
      } else {
        router.push(`${paths.plans}?status=${RecordStatus.Submitted}&aviso=sin-pendientes`);
      }
    });
  }, [backQuery, buildBody, canDecide, clearDraft, fail, paths.plans, plan.id, router, run, user]);

  /** Devuelve con las observaciones; ya confirmado por quien revisa. */
  const confirmReturn = useCallback(async (): Promise<void> => {
    if (!canDecide) {
      return;
    }
    const body = buildBody('return');
    if (!body) {
      return;
    }
    lastDecision.current = 'return';
    await run('return', async () => {
      const result = await returnPlan(plan.id, body as Parameters<typeof returnPlan>[1]);
      if (!result.ok) {
        fail(result.error);
        return;
      }
      clearDraft();
      dispatch({ type: 'reset' });
      setLostComment(null);
      await refresh();
      setNotice({
        tone: 'success',
        text: 'Devolviste la planeación con observaciones. El docente las verá y podrá corregirla.',
      });
      window.scrollTo({ top: 0 });
    });
  }, [buildBody, canDecide, clearDraft, fail, plan.id, refresh, run]);

  /** Anula la planeación con su motivo; devuelve el mensaje de error o `null`. */
  const voidWithReason = useCallback(
    async (reason: string): Promise<string | null> => {
      let failure: string | null = null;
      await run('void', async () => {
        const result = await voidPlan(plan.id, reason);
        if (!result.ok) {
          failure = result.error.message;
          return;
        }
        clearDraft();
        dispatch({ type: 'reset' });
        await refresh();
        setNotice({ tone: 'success', text: 'Planeación anulada. Queda constancia del motivo.' });
        window.scrollTo({ top: 0 });
      });
      return failure;
    },
    [clearDraft, plan.id, refresh, run],
  );

  const warnNoObservation = useCallback(
    () =>
      setNotice({
        tone: 'warning',
        text: 'Escribe al menos una observación (por bloque o general) para devolver la planeación.',
      }),
    [],
  );

  const retryLast = useCallback(
    () => (lastDecision.current === 'approve' ? approveAndNext() : confirmReturn()),
    [approveAndNext, confirmReturn],
  );

  return {
    blocks,
    state,
    canDecide,
    canReview,
    consultText,
    blockedReason,
    own,
    changes,
    comment,
    excess,
    observationCount,
    adjustmentCount,
    history,
    adjustedDates,
    resubmission,
    notice,
    dismissNotice: () => setNotice(null),
    blockErrors,
    lostComment,
    busy,
    userName: user?.fullName ?? '',
    edit,
    setObservation,
    setGeneral,
    saveAdjustment,
    removeAdjustment,
    saveDraft,
    approveAndNext,
    confirmReturn,
    voidWithReason,
    retryLast,
    warnNoObservation,
  };
}

export type PlanReview = ReturnType<typeof usePlanReview>;
