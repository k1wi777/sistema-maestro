import { TrainingActivityStatus, type TrainingModuleDetail } from '@gns/shared';

export const EDITOR_STEP_IDS = [
  'datos',
  'video',
  'desafio',
  'presentacion',
  'actividades',
  'vista-previa',
] as const;
export type EditorStepId = (typeof EDITOR_STEP_IDS)[number];

export const EDITOR_STEP_TITLE: Record<EditorStepId, string> = {
  datos: 'Datos del módulo',
  video: 'Video',
  desafio: 'Desafío GNS',
  presentacion: 'Presentación',
  actividades: 'Actividades',
  'vista-previa': 'Vista previa',
};

export function isEditorStepId(value: string | null): value is EditorStepId {
  return value !== null && (EDITOR_STEP_IDS as readonly string[]).includes(value);
}

/** Contenidos del módulo guardado, con la misma regla que `requirePublishable` de la API. */
export interface ModuleContents {
  video: boolean;
  challenge: boolean;
  presentation: boolean;
  activities: boolean;
}

export function activeActivities(detail: Pick<TrainingModuleDetail, 'activities'>) {
  return detail.activities.filter((activity) => activity.status === TrainingActivityStatus.Active);
}

export function moduleContents(detail: TrainingModuleDetail): ModuleContents {
  return {
    video: detail.videoUrl !== null || detail.videoFile !== null,
    challenge: detail.questions.length > 0,
    presentation:
      detail.presentationUrl !== null ||
      detail.presentationFile !== null ||
      detail.slides.length > 0,
    activities: activeActivities(detail).length > 0,
  };
}

export interface EditorStepView {
  id: EditorStepId;
  title: string;
  /** `empty`: sin contenido (y opcional); `done`: con contenido; el último paso no tiene estado. */
  state: 'done' | 'empty' | 'pending';
  hint: string;
}

const CONTENT_KEY: Record<Exclude<EditorStepId, 'datos' | 'vista-previa'>, keyof ModuleContents> = {
  video: 'video',
  desafio: 'challenge',
  presentacion: 'presentation',
  actividades: 'activities',
};

/** Los seis pasos con su estado: con contenido o vacío y opcional (R7). */
export function editorSteps(detail: TrainingModuleDetail): EditorStepView[] {
  const contents = moduleContents(detail);
  return EDITOR_STEP_IDS.map((id): EditorStepView => {
    const title = EDITOR_STEP_TITLE[id];
    if (id === 'datos') {
      return { id, title, state: 'done', hint: 'Obligatorio' };
    }
    if (id === 'vista-previa') {
      return { id, title, state: 'pending', hint: 'Así lo verá el docente' };
    }
    const filled = contents[CONTENT_KEY[id]];
    return {
      id,
      title,
      state: filled ? 'done' : 'empty',
      hint: filled ? 'Con contenido' : 'Vacío · opcional',
    };
  });
}

export interface Publishability {
  publishable: boolean;
  /** Qué falta, para explicarlo junto al botón deshabilitado. */
  missing: string | null;
}

/** Un módulo necesita al menos un contenido para publicarse (misma regla que la API). */
export function publishability(detail: TrainingModuleDetail): Publishability {
  const contents = moduleContents(detail);
  if (Object.values(contents).some(Boolean)) {
    return { publishable: true, missing: null };
  }
  return {
    publishable: false,
    missing:
      'Agrega al menos un contenido para poder publicarlo: un video, una presentación o diapositivas, preguntas del Desafío o una actividad.',
  };
}
