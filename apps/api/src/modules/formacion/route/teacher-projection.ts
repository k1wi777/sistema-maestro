import {
  parseActivityConfig,
  TeacherModuleState,
  TrainingActivityType,
  wheelPassportDetailSchema,
  type TeacherActivity,
  type TeacherActivitySummary,
  type TeacherModule,
  type TeacherModuleSummary,
  type TeacherRoute,
} from '@gns/shared';
import type {
  RouteActivityRow,
  RouteModuleRow,
  RoutePlanRow,
  TeacherModuleRow,
} from '../plans/training-plan.repository';
import type {
  ActivityProgressRecord,
  ModuleProgressView,
} from '../progress/training-progress.repository';

/**
 * Proyección del contenido para el docente. Se construye por lista blanca, campo por campo:
 * ninguna solución, retroalimentación ni pareja sale de aquí, aunque la fila las traiga (R18).
 */

const wheelKeys = (config: unknown): string[] => {
  const parsed = parseActivityConfig(TrainingActivityType.WheelPassport, config);
  return parsed.success ? parsed.data.tarjetas.map((card) => card.clave) : [];
};

/** Sellos del pasaporte que siguen siendo tarjetas de la configuración vigente. */
export function validStamps(
  row: RouteActivityRow,
  progress: ActivityProgressRecord | undefined,
): string[] {
  if (row.type !== TrainingActivityType.WheelPassport || !progress) {
    return [];
  }
  const detail = wheelPassportDetailSchema.safeParse(progress.detail);
  if (!detail.success) {
    return [];
  }
  const keys = new Set(wheelKeys(row.config));
  return [...new Set(detail.data.sellos)].filter((stamp) => keys.has(stamp));
}

/** Pasos: «en curso» con cualquier avance en el módulo o en sus actividades. */
export function teacherModuleState(
  progress: ModuleProgressView | undefined,
  activities: readonly (ActivityProgressRecord | undefined)[],
): TeacherModuleState {
  if (progress?.completedAt) {
    return TeacherModuleState.Done;
  }
  const moduleStarted =
    progress !== undefined &&
    (progress.videoViewedAt !== null ||
      progress.presentationViewedAt !== null ||
      progress.bestScore !== null ||
      progress.attempts > 0 ||
      progress.challengeGame !== null);
  const activityStarted = activities.some(
    (item) =>
      item !== undefined &&
      (item.completedAt !== null ||
        item.attempts > 0 ||
        item.bestScore !== null ||
        item.detail !== null ||
        item.game !== null),
  );
  return moduleStarted || activityStarted
    ? TeacherModuleState.InProgress
    : TeacherModuleState.Pending;
}

export function projectActivitySummary(
  row: RouteActivityRow,
  progress: ActivityProgressRecord | undefined,
): TeacherActivitySummary {
  const isWheel = row.type === TrainingActivityType.WheelPassport;
  return {
    id: row.id,
    type: row.type as TrainingActivityType,
    title: row.title,
    isRequired: row.isRequired,
    completedAt: progress?.completedAt ?? null,
    bestScore: progress?.bestScore ?? null,
    stamps: isWheel
      ? { done: validStamps(row, progress).length, total: wheelKeys(row.config).length }
      : null,
  };
}

function projectModuleSummary(
  row: RouteModuleRow,
  progress: ModuleProgressView | undefined,
  activityProgress: ReadonlyMap<string, ActivityProgressRecord>,
): TeacherModuleSummary {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    summary: row.summary,
    state: teacherModuleState(
      progress,
      row.activities.map((activity) => activityProgress.get(activity.id)),
    ),
    steps: {
      video: row.videoUrl !== null,
      presentation: row.slideCount > 0 || row.presentationUrl !== null,
      challenge: row.questionCount > 0,
      activities: row.activities.length,
    },
    bestScore: progress?.bestScore ?? null,
    completedAt: progress?.completedAt ?? null,
    activities: row.activities.map((activity) =>
      projectActivitySummary(activity, activityProgress.get(activity.id)),
    ),
  };
}

/** Planes General primero y luego por nombre del área; secciones sin módulos activos, omitidas. */
export function projectRoute(
  schoolYear: string,
  plans: readonly RoutePlanRow[],
  moduleProgress: ReadonlyMap<string, ModuleProgressView>,
  activityProgress: ReadonlyMap<string, ActivityProgressRecord>,
): TeacherRoute {
  const ordered = [...plans].sort((a, b) => {
    if ((a.areaId === null) !== (b.areaId === null)) {
      return a.areaId === null ? -1 : 1;
    }
    return (
      (a.areaName ?? '').localeCompare(b.areaName ?? '', 'es') ||
      a.name.localeCompare(b.name, 'es') ||
      a.id.localeCompare(b.id)
    );
  });
  return {
    schoolYear,
    plans: ordered.map((plan) => {
      const sections = plan.sections
        .filter((section) => section.modules.length > 0)
        .map((section) => ({
          id: section.id,
          title: section.title,
          subtitle: section.subtitle,
          modules: section.modules.map((module) =>
            projectModuleSummary(module, moduleProgress.get(module.id), activityProgress),
          ),
        }));
      const modules = sections.flatMap((section) => section.modules);
      return {
        id: plan.id,
        name: plan.name,
        areaId: plan.areaId,
        areaName: plan.areaName,
        totals: {
          modules: modules.length,
          completed: modules.filter((module) => module.state === TeacherModuleState.Done).length,
        },
        sections,
      };
    }),
  };
}

function projectActivity(
  row: RouteActivityRow,
  progress: ActivityProgressRecord | undefined,
): TeacherActivity | null {
  const common = {
    id: row.id,
    title: row.title,
    isRequired: row.isRequired,
    instructions: row.instructions,
    progress: {
      completedAt: progress?.completedAt ?? null,
      bestScore: progress?.bestScore ?? null,
      bestPoints: progress?.bestPoints ?? null,
      attempts: progress?.attempts ?? 0,
      stamps: validStamps(row, progress),
    },
  };
  switch (row.type) {
    case TrainingActivityType.WheelPassport: {
      const parsed = parseActivityConfig(TrainingActivityType.WheelPassport, row.config);
      if (!parsed.success) {
        return null;
      }
      return {
        ...common,
        type: TrainingActivityType.WheelPassport,
        config: {
          insignia: parsed.data.insignia,
          tarjetas: parsed.data.tarjetas.map((card) => ({
            clave: card.clave,
            emoji: card.emoji,
            titulo_corto: card.titulo_corto,
            titulo: card.titulo,
            dato: card.dato,
            hechos: card.hechos,
            ...(card.enlace ? { enlace: { texto: card.enlace.texto, url: card.enlace.url } } : {}),
            pregunta: {
              enunciado: card.pregunta.enunciado,
              opciones: card.pregunta.opciones,
            },
          })),
        },
      };
    }
    case TrainingActivityType.Match: {
      const parsed = parseActivityConfig(TrainingActivityType.Match, row.config);
      if (!parsed.success) {
        return null;
      }
      return {
        ...common,
        type: TrainingActivityType.Match,
        config: {
          pares_por_ronda: parsed.data.pares_por_ronda,
          rondas: parsed.data.rondas,
          segundos_por_ronda: parsed.data.segundos_por_ronda,
          umbral_aprobacion: parsed.data.umbral_aprobacion,
        },
      };
    }
    case TrainingActivityType.TrueOrMyth: {
      const parsed = parseActivityConfig(TrainingActivityType.TrueOrMyth, row.config);
      if (!parsed.success) {
        return null;
      }
      return {
        ...common,
        type: TrainingActivityType.TrueOrMyth,
        config: {
          por_partida: parsed.data.por_partida,
          vidas: parsed.data.vidas,
          segundos_por_afirmacion: parsed.data.segundos_por_afirmacion,
          umbral_aprobacion: parsed.data.umbral_aprobacion,
        },
      };
    }
    case TrainingActivityType.Simulator: {
      const parsed = parseActivityConfig(TrainingActivityType.Simulator, row.config);
      return parsed.success
        ? { ...common, type: TrainingActivityType.Simulator, config: { ...parsed.data } }
        : null;
    }
    default:
      return null;
  }
}

export function projectModule(
  row: TeacherModuleRow,
  progress: ModuleProgressView | undefined,
  activityProgress: ReadonlyMap<string, ActivityProgressRecord>,
): TeacherModule {
  return {
    id: row.id,
    planId: row.planId,
    section: { id: row.sectionId, title: row.sectionTitle },
    number: row.number,
    title: row.title,
    summary: row.summary,
    videoUrl: row.videoUrl,
    videoTitle: row.videoTitle,
    presentationUrl: row.presentationUrl,
    slides: row.slides.map((slide) => ({
      id: slide.id,
      title: slide.title,
      keyIdeas: slide.keyIdeas,
    })),
    challenge: {
      questionCount: row.questionCount,
      approvalThreshold: row.approvalThreshold,
      secondsPerQuestion: row.secondsPerQuestion,
    },
    state: teacherModuleState(
      progress,
      row.activities.map((activity) => activityProgress.get(activity.id)),
    ),
    progress: {
      videoViewedAt: progress?.videoViewedAt ?? null,
      presentationViewedAt: progress?.presentationViewedAt ?? null,
      bestScore: progress?.bestScore ?? null,
      bestPoints: progress?.bestPoints ?? null,
      attempts: progress?.attempts ?? 0,
      passedAt: progress?.passedAt ?? null,
      completedAt: progress?.completedAt ?? null,
    },
    activities: row.activities.flatMap((activity) => {
      const projected = projectActivity(activity, activityProgress.get(activity.id));
      return projected ? [projected] : [];
    }),
  };
}
