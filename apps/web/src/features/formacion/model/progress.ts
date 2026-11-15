import {
  CertificateKind,
  type CertificateSummary,
  type TeacherModuleState,
  type TeacherRoute,
} from '@gns/shared';

import { moduleTitleWithNumber } from './labels';

export type StepCell = 'viewed' | 'pending' | 'not_applicable';

export type ChallengeCell = { kind: 'not_applicable' } | { kind: 'score'; score: number | null };

export interface ProgressRow {
  moduleId: string;
  planName: string;
  title: string;
  video: StepCell;
  challenge: ChallengeCell;
  presentation: StepCell;
  requiredDone: number;
  requiredTotal: number;
  state: TeacherModuleState;
  /** Certificado del módulo, si ya se emitió. */
  certificateId: string | null;
}

const stepCell = (applies: boolean, viewedAt: Date | null): StepCell =>
  !applies ? 'not_applicable' : viewedAt === null ? 'pending' : 'viewed';

/** Una fila por módulo de la ruta; los certificados se emparejan por `moduleId`. */
export function progressRows(
  route: TeacherRoute,
  certificates: readonly CertificateSummary[],
): ProgressRow[] {
  const byModule = new Map<string, string>();
  for (const certificate of certificates) {
    if (certificate.moduleId !== null) {
      byModule.set(certificate.moduleId, certificate.id);
    }
  }
  return route.plans.flatMap((plan) =>
    plan.sections.flatMap((section) =>
      section.modules.map((module): ProgressRow => {
        const required = module.activities.filter((activity) => activity.isRequired);
        return {
          moduleId: module.id,
          planName: plan.name,
          title: moduleTitleWithNumber(module),
          video: stepCell(module.steps.video, module.videoViewedAt),
          challenge: module.steps.challenge
            ? { kind: 'score', score: module.bestScore }
            : { kind: 'not_applicable' },
          presentation: stepCell(module.steps.presentation, module.presentationViewedAt),
          requiredDone: required.filter((activity) => activity.completedAt !== null).length,
          requiredTotal: required.length,
          state: module.state,
          certificateId: byModule.get(module.id) ?? null,
        };
      }),
    ),
  );
}

export interface RouteCertificate {
  certificate: CertificateSummary | null;
  /** Módulos que faltan para obtenerlo (total menos terminados). */
  missing: number;
}

/** Certificado de la ruta completa: el emitido o cuántos módulos faltan. */
export function routeCertificate(
  route: TeacherRoute,
  certificates: readonly CertificateSummary[],
): RouteCertificate {
  const total = route.plans.reduce((sum, plan) => sum + plan.totals.modules, 0);
  const completed = route.plans.reduce((sum, plan) => sum + plan.totals.completed, 0);
  return {
    certificate: certificates.find((item) => item.kind === CertificateKind.Route) ?? null,
    missing: Math.max(0, total - completed),
  };
}
