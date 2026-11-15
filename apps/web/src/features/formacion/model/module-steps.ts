import { TrainingActivityType, type TeacherActivity, type TeacherModule } from '@gns/shared';

export type SectionKind = 'video' | 'challenge' | 'presentation' | 'activities';

export interface ModuleSection {
  kind: SectionKind;
  /** Número visible, consecutivo según las secciones que el módulo tiene. */
  number: number;
}

/** Qué contenidos tiene el módulo (misma regla que la terminación en la API, solo para pintar). */
export function moduleContents(module: TeacherModule): Record<SectionKind, boolean> {
  return {
    video: module.videoSource !== null,
    challenge: module.challenge.questionCount > 0,
    presentation:
      module.slides.length > 0 ||
      module.presentationUrl !== null ||
      module.presentationFile !== null,
    activities: module.activities.length > 0,
  };
}

const ORDER: readonly SectionKind[] = ['video', 'challenge', 'presentation', 'activities'];

/** Secciones que existen, en el orden video, Desafío, presentación y actividades, ya numeradas. */
export function moduleSections(module: TeacherModule): ModuleSection[] {
  const contents = moduleContents(module);
  return ORDER.filter((kind) => contents[kind]).map((kind, index) => ({ kind, number: index + 1 }));
}

export interface FinishItem {
  key: string;
  label: string;
  done: boolean;
}

export interface FinishList {
  items: FinishItem[];
  /** Hay al menos un elemento obligatorio; si no, el módulo se termina con el primer avance. */
  hasRequired: boolean;
  /** Hay actividades opcionales: se explica que no bloquean el certificado. */
  hasOptionalNote: boolean;
}

/** Etiqueta de una actividad obligatoria con su avance según el tipo (R18). */
function activityLabel(activity: TeacherActivity): string {
  const { progress } = activity;
  switch (activity.type) {
    case TrainingActivityType.WheelPassport:
      return `${activity.title} · ${progress.stamps.length} de ${activity.config.tarjetas.length} sellos`;
    case TrainingActivityType.Simulator:
      return `${activity.title} · ${progress.completedAt !== null ? 'usado' : 'úsalo una vez'}`;
    default:
      return `${activity.title} · necesitas ${activity.config.umbral_aprobacion}%, ${
        progress.bestScore === null ? 'aún sin intentos' : `llevas ${progress.bestScore}%`
      }`;
  }
}

/** «Para terminar», derivada de `moduleSections` para que nunca discrepe de la numeración. */
export function finishList(module: TeacherModule): FinishList {
  const items: FinishItem[] = [];
  for (const { kind } of moduleSections(module)) {
    if (kind === 'video') {
      items.push({ key: 'video', label: 'Video', done: module.progress.videoViewedAt !== null });
    } else if (kind === 'challenge') {
      const best = module.progress.bestScore;
      items.push({
        key: 'challenge',
        label: `Desafío GNS · necesitas ${module.challenge.approvalThreshold}%, ${
          best === null ? 'aún sin intentos' : `llevas ${best}%`
        }`,
        done: module.progress.passedAt !== null,
      });
    } else if (kind === 'presentation') {
      items.push({
        key: 'presentation',
        label: 'Presentación',
        done: module.progress.presentationViewedAt !== null,
      });
    } else {
      for (const activity of module.activities) {
        if (activity.isRequired) {
          items.push({
            key: activity.id,
            label: activityLabel(activity),
            done: activity.progress.completedAt !== null,
          });
        }
      }
    }
  }
  return {
    items,
    hasRequired: items.length > 0,
    hasOptionalNote: module.activities.some((activity) => !activity.isRequired),
  };
}
