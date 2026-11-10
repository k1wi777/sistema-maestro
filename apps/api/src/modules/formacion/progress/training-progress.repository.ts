export interface ModuleProgressRecord {
  id: string;
  teacherId: string;
  moduleId: string;
  videoViewedAt: Date | null;
  presentationViewedAt: Date | null;
  bestScore: number | null;
  passedAt: Date | null;
  completedAt: Date | null;
  /** Partida del Desafío en curso; su forma la valida `game-state.ts`. */
  challengeGame: unknown;
}

export interface ActivityProgressRecord {
  id: string;
  teacherId: string;
  activityId: string;
  completedAt: Date | null;
  bestScore: number | null;
  bestPoints: number | null;
  attempts: number;
  detail: unknown;
  /** Partida en curso de conecta o verdad o mito. */
  game: unknown;
}

export interface ModuleProgressChanges {
  videoViewedAt?: Date;
  presentationViewedAt?: Date;
  bestScore?: number;
  passedAt?: Date;
  completedAt?: Date;
  /** `null` borra la partida. */
  challengeGame?: unknown;
}

export interface ActivityProgressChanges {
  completedAt?: Date;
  bestScore?: number;
  bestPoints?: number;
  attempts?: number;
  detail?: unknown;
  /** `null` borra la partida. */
  game?: unknown;
}

/** Lo que la regla de terminación necesita saber del módulo y del progreso (lee la base actual). */
export interface CompletionSnapshot {
  moduleCompletedAt: Date | null;
  videoUrl: string | null;
  presentationUrl: string | null;
  slideCount: number;
  questionCount: number;
  videoViewedAt: Date | null;
  presentationViewedAt: Date | null;
  passedAt: Date | null;
  /** Actividades obligatorias activas con su fecha de completado. */
  requiredActivities: { id: string; completedAt: Date | null }[];
}

/** Progreso, intentos y partidas de los docentes; toda escritura parte de una fila bloqueada. */
export interface TrainingProgressRepository {
  /** Asegura la fila con `ON CONFLICT DO NOTHING` y la bloquea hasta el fin de la transacción. */
  lockModuleProgress(teacherId: string, moduleId: string): Promise<ModuleProgressRecord>;
  lockActivityProgress(teacherId: string, activityId: string): Promise<ActivityProgressRecord>;
  updateModuleProgress(id: string, changes: ModuleProgressChanges): Promise<ModuleProgressRecord>;
  updateActivityProgress(
    id: string,
    changes: ActivityProgressChanges,
  ): Promise<ActivityProgressRecord>;
  insertAttempt(progressId: string, score: number, points: number, date: Date): Promise<string>;
  maxChallengePoints(progressId: string): Promise<number | null>;
  completionSnapshot(teacherId: string, moduleId: string): Promise<CompletionSnapshot | null>;

  // Lecturas para la ruta y la vista del módulo
  listModuleProgress(
    teacherId: string,
    moduleIds: readonly string[],
  ): Promise<ModuleProgressView[]>;
  listActivityProgress(
    teacherId: string,
    activityIds: readonly string[],
  ): Promise<ActivityProgressRecord[]>;
}

export interface ModuleProgressView extends ModuleProgressRecord {
  attempts: number;
  bestPoints: number | null;
}

export const TRAINING_PROGRESS_REPOSITORY = Symbol('TRAINING_PROGRESS_REPOSITORY');
