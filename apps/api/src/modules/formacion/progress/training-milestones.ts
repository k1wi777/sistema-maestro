import { Injectable } from '@nestjs/common';
import { AuditLogType, type CertificateKind } from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { AuditLogService } from '../../auditoria/audit-log.service';

export interface GameResultSummary {
  score: number;
  points: number;
  passed: boolean;
}

/**
 * Hitos del docente en la bitácora (R30). Se escriben desde el servicio, dentro de su
 * transacción: si la fila falla, la operación se revierte. Nunca se registran respuestas
 * individuales, `next`, sellos que no completan la ruleta, marcas repetidas, el estado de la
 * partida ni valores del simulador.
 */
@Injectable()
export class TrainingMilestones {
  constructor(private readonly audit: AuditLogService) {}

  private record(
    user: RequestUser,
    action: string,
    entity: string,
    entityId: string,
    dataAfter: Record<string, unknown>,
  ): Promise<void> {
    return this.audit.record({
      userId: user.id,
      role: user.role,
      type: AuditLogType.Training,
      action,
      entity,
      entityId,
      dataAfter,
    });
  }

  challengeStarted(user: RequestUser, progressId: string, moduleId: string): Promise<void> {
    return this.record(user, 'Inició el Desafío GNS', 'progreso_modulo', progressId, { moduleId });
  }

  challengeFinished(
    user: RequestUser,
    attemptId: string,
    moduleId: string,
    result: GameResultSummary,
  ): Promise<void> {
    return this.record(user, 'Terminó el Desafío GNS', 'intento_desafio', attemptId, {
      moduleId,
      ...result,
    });
  }

  activityStarted(user: RequestUser, progressId: string, activityId: string): Promise<void> {
    return this.record(user, 'Inició una actividad', 'progreso_actividad', progressId, {
      activityId,
    });
  }

  activityFinished(
    user: RequestUser,
    progressId: string,
    activityId: string,
    result: GameResultSummary,
  ): Promise<void> {
    return this.record(user, 'Terminó una actividad', 'progreso_actividad', progressId, {
      activityId,
      ...result,
    });
  }

  videoViewed(
    user: RequestUser,
    progressId: string,
    moduleId: string,
    viewedAt: Date,
  ): Promise<void> {
    return this.record(user, 'Vio el video', 'progreso_modulo', progressId, {
      moduleId,
      videoViewedAt: viewedAt,
    });
  }

  presentationViewed(
    user: RequestUser,
    progressId: string,
    moduleId: string,
    viewedAt: Date,
  ): Promise<void> {
    return this.record(user, 'Revisó la presentación', 'progreso_modulo', progressId, {
      moduleId,
      presentationViewedAt: viewedAt,
    });
  }

  activityCompleted(
    user: RequestUser,
    progressId: string,
    activityId: string,
    completedAt: Date,
  ): Promise<void> {
    return this.record(user, 'Completó una actividad', 'progreso_actividad', progressId, {
      activityId,
      completedAt,
    });
  }

  /** Nunca se registra el código de verificación. */
  certificateIssued(
    user: RequestUser,
    certificateId: string,
    kind: CertificateKind,
    moduleId: string | null,
  ): Promise<void> {
    return this.record(user, 'Obtuvo un certificado', 'certificado', certificateId, {
      kind,
      moduleId,
    });
  }

  certificateDownloaded(
    user: RequestUser,
    certificateId: string,
    kind: CertificateKind,
  ): Promise<void> {
    return this.record(user, 'Descargó un certificado', 'certificado', certificateId, { kind });
  }

  moduleCompleted(
    user: RequestUser,
    progressId: string,
    moduleId: string,
    completedAt: Date,
  ): Promise<void> {
    return this.record(user, 'Terminó un módulo', 'progreso_modulo', progressId, {
      moduleId,
      completedAt,
    });
  }
}
