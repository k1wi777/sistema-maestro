import {
  DigitalTool,
  LESSON_PLAN_CORNER_MAX_LENGTH,
  LESSON_PLAN_TEXT_MAX_LENGTH,
  LESSON_PLAN_TOPIC_MAX_LENGTH,
  RESOURCE_NAME_MAX_LENGTH,
  SHARED_ACTIVITY_CORNER_MAX_LENGTH,
  SHARED_ACTIVITY_TEXT_MAX_LENGTH,
  SHARED_ACTIVITY_TITLE_MAX_LENGTH,
  SharedActivityType,
  levelAllowsCuriocity,
  lessonPlanAreasLabel,
  type LessonPlan,
  type SharedActivity,
} from '@gns/shared';

import type { CreateLessonPlanBody, CreateResourceBody } from '../api/lesson-plans';
import { EMPTY_ACTIVITY_FORM, type ActivityFormValues } from './activity-form';
import type { FormValues } from './form-state';
import { MOMENTS, type MomentField } from './steps';

function clip(text: string, max: number): { text: string; clipped: boolean } {
  const value = text.trim();
  return value.length > max
    ? { text: value.slice(0, max).trimEnd(), clipped: true }
    : { text: value, clipped: false };
}

/** Momento al que va el enlace de una actividad usada como base de una planeación (desarrollo). */
export const ACTIVITY_LINK_MOMENT = 2;

export interface ActivityPlanContent {
  /** Contenido para `POST /lesson-plans` (sin grado, área ni periodo, que elige el docente). */
  content: Pick<
    CreateLessonPlanBody,
    'topic' | 'expectedPerformance' | 'developmentMoment' | 'resources' | 'learningCorner'
  >;
  /** Campos que se recortaron por superar el máximo: el docente debe revisarlos. */
  clipped: (
    'topic' | 'expectedPerformance' | 'developmentMoment' | 'resources' | 'learningCorner'
  )[];
}

/**
 * Actividad → contenido de una planeación nueva. El rincón solo se copia si el nivel de la
 * planeación no es de CurioCity (bachillerato usa etapas, no rincones); la duración y el tipo se
 * descartan y el D.U.A nunca se toca.
 */
export function activityToPlanContent(
  activity: SharedActivity,
  planLevelName: string,
): ActivityPlanContent {
  const clipped: ActivityPlanContent['clipped'] = [];
  const content: ActivityPlanContent['content'] = {};
  const copy = (
    field: ActivityPlanContent['clipped'][number],
    source: string | null,
    max: number,
  ) => {
    if (!source || source.trim() === '') {
      return;
    }
    const result = clip(source, max);
    content[field] = result.text;
    if (result.clipped) {
      clipped.push(field);
    }
  };
  copy('topic', activity.title, LESSON_PLAN_TOPIC_MAX_LENGTH);
  copy('expectedPerformance', activity.objective, LESSON_PLAN_TEXT_MAX_LENGTH);
  copy('developmentMoment', activity.steps, LESSON_PLAN_TEXT_MAX_LENGTH);
  copy('resources', activity.materials, LESSON_PLAN_TEXT_MAX_LENGTH);
  if (!levelAllowsCuriocity(planLevelName)) {
    copy('learningCorner', activity.learningCorner, LESSON_PLAN_CORNER_MAX_LENGTH);
  }
  return { content, clipped };
}

/** Enlace de la actividad como recurso digital de la planeación (herramienta «Otra», momento 2). */
export function activityLinkResource(activity: SharedActivity): CreateResourceBody | null {
  if (!activity.link) {
    return null;
  }
  return {
    tool: DigitalTool.Other,
    name: clip(activity.title, RESOURCE_NAME_MAX_LENGTH).text,
    url: activity.link,
    moment: ACTIVITY_LINK_MOMENT,
  };
}

export interface PlanActivityDraft {
  values: ActivityFormValues;
  /** Campos recortados al superar los máximos de una actividad. */
  clipped: ('title' | 'steps' | 'objective' | 'materials' | 'learningCorner')[];
}

const STEP_LABELS: Record<MomentField, string> = {
  explorationMoment: 'Exploración',
  developmentMoment: 'Desarrollo',
  socializationMoment: 'Socialización',
  closingMoment: 'Cierre',
};

/**
 * Planeación → borrador de actividad para compartir. Nunca copia el D.U.A ni los
 * recursos digitales: solo lo que sirve a otros docentes. El paso a paso reúne los momentos
 * escritos con su nombre. El nivel lo deriva la API desde el grado.
 */
export function planToActivityDraft(plan: LessonPlan): PlanActivityDraft {
  const clipped: PlanActivityDraft['clipped'] = [];
  const fit = (
    field: PlanActivityDraft['clipped'][number],
    source: string | null,
    max: number,
  ): string => {
    const result = clip(source ?? '', max);
    if (result.clipped) {
      clipped.push(field);
    }
    return result.text;
  };
  const steps = MOMENTS.filter((moment) => (plan[moment.field] ?? '').trim() !== '')
    .map(
      (moment) =>
        `${moment.number}. ${STEP_LABELS[moment.field]}: ${(plan[moment.field] ?? '').trim()}`,
    )
    .join('\n\n');
  return {
    values: {
      ...EMPTY_ACTIVITY_FORM,
      title: fit(
        'title',
        plan.topic?.trim() || `${lessonPlanAreasLabel(plan.areas)} · ${plan.grade.name}`,
        SHARED_ACTIVITY_TITLE_MAX_LENGTH,
      ),
      objective: fit('objective', plan.expectedPerformance, SHARED_ACTIVITY_TEXT_MAX_LENGTH),
      activityType: SharedActivityType.Activity,
      gradeId: plan.grade.id,
      // Una actividad tiene una sola área: se propone la primera (alfabética) y el docente puede cambiarla.
      areaId: plan.areas[0]?.id ?? '',
      learningCorner: fit('learningCorner', plan.learningCorner, SHARED_ACTIVITY_CORNER_MAX_LENGTH),
      materials: fit('materials', plan.resources, SHARED_ACTIVITY_TEXT_MAX_LENGTH),
      steps: fit('steps', steps, SHARED_ACTIVITY_TEXT_MAX_LENGTH),
    },
    clipped,
  };
}

export type AppendResult = { ok: true; values: FormValues } | { ok: false; message: string };

/**
 * Agrega una idea al final de un momento sin borrar lo escrito: el título entre comillas y su paso
 * a paso, separados de lo anterior por una línea en blanco. Si el resultado supera el máximo del
 * campo no la agrega.
 */
export function appendToMoment(
  values: FormValues,
  field: MomentField,
  activity: Pick<SharedActivity, 'title' | 'steps'>,
): AppendResult {
  const block = `«${activity.title.trim()}»\n${activity.steps.trim()}`;
  const current = values[field].trimEnd();
  const next = current === '' ? block : `${current}\n\n${block}`;
  if (next.length > LESSON_PLAN_TEXT_MAX_LENGTH) {
    const moment = MOMENTS.find((candidate) => candidate.field === field);
    return {
      ok: false,
      message: `No cabe en el Momento ${moment?.number ?? ''}: superaría los ${LESSON_PLAN_TEXT_MAX_LENGTH} caracteres. Acorta lo escrito o agrégala a otro momento.`,
    };
  }
  return { ok: true, values: { ...values, [field]: next } };
}
