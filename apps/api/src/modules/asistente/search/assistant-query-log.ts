import { Injectable } from '@nestjs/common';
import { AuditLogType } from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { AuditLogService } from '../../auditoria/audit-log.service';

/**
 * Consultas al asistente en la bitácora (D1). Nunca se registra el texto escrito: la bitácora es
 * inmutable y el texto puede traer nombres de estudiantes. Se escribe desde el servicio, dentro de
 * su transacción, como los hitos de formación.
 */
@Injectable()
export class AssistantQueryLog {
  constructor(private readonly audit: AuditLogService) {}

  answered(user: RequestUser, faqId: string): Promise<void> {
    return this.audit.record({
      userId: user.id,
      role: user.role,
      type: AuditLogType.Assistant,
      action: 'Consultó el asistente',
      entity: 'pregunta_frecuente',
      entityId: faqId,
    });
  }

  /** `unansweredId` es nulo cuando la consulta no tenía palabras significativas y no se registró. */
  unanswered(user: RequestUser, unansweredId: string | null): Promise<void> {
    return this.audit.record({
      userId: user.id,
      role: user.role,
      type: AuditLogType.Assistant,
      action: 'Hizo una pregunta sin respuesta al asistente',
      entity: unansweredId ? 'pregunta_sin_respuesta' : null,
      entityId: unansweredId,
    });
  }
}
