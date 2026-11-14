import type { TrackedProgress } from './tracking-summary';

/** Pares docente-módulo con certificado emitido. */
export interface TrackedCertificate {
  teacherId: string;
  moduleId: string;
}

/** Lecturas del seguimiento: progreso y certificados de un conjunto de docentes y módulos. */
export interface TrainingTrackingRepository {
  findProgress(
    moduleIds: readonly string[],
    teacherIds: readonly string[],
  ): Promise<TrackedProgress[]>;
  findModuleCertificates(
    moduleIds: readonly string[],
    teacherIds: readonly string[],
  ): Promise<TrackedCertificate[]>;
}

export const TRAINING_TRACKING_REPOSITORY = Symbol('TRAINING_TRACKING_REPOSITORY');
