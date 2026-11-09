import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { from, lastValueFrom, type Observable } from 'rxjs';
import { z } from 'zod';
import { AuditLogService } from '../../modules/auditoria/audit-log.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../shared/database/transaction-runner';
import { AUDITED_KEY, type AuditedOptions } from './audited.decorator';
import { AuditWriteError } from './audit-write.error';
import { diffFirstLevel, resolveAuditDetail } from './audit-data';
import type { AuditSnapshotSource } from './audit-snapshot';
import type { RequestUser } from './request-user';

interface AuditedRequest {
  params?: Record<string, unknown>;
  body?: unknown;
  user?: RequestUser;
}

const isUuid = (value: unknown): value is string => z.uuid().safeParse(value).success;

function idOf(result: unknown): string | undefined {
  const id = (result as { id?: unknown } | null | undefined)?.id;
  return isUuid(id) ? id : undefined;
}

/**
 * Registra en la bitácora los endpoints marcados con `@Audited`. El handler y la
 * escritura de la fila corren en una sola transacción: si el handler falla no hay
 * fila, y si la fila falla la operación de negocio se revierte (R17).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
    private readonly audit: AuditLogService,
    @Inject(TRANSACTION_RUNNER) private readonly transactions: TransactionRunner,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<AuditedOptions | undefined>(
      AUDITED_KEY,
      context.getHandler(),
    );
    if (!options) {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<AuditedRequest>();
    return from(this.transactions.run(() => this.runAudited(options, request, next)));
  }

  private async runAudited(
    options: AuditedOptions,
    request: AuditedRequest,
    next: CallHandler,
  ): Promise<unknown> {
    const source = this.moduleRef.get<AuditSnapshotSource>(options.snapshot, { strict: false });

    // El id de la ruta solo se usa si es un UUID: si no lo es, la validación del
    // handler responderá 400 y no se audita (y evita una consulta con un id inválido).
    const routeId = isUuid(request.params?.id) ? request.params.id : undefined;
    const before = routeId ? await source.load(routeId) : null;

    const result: unknown = await lastValueFrom(next.handle(), { defaultValue: undefined });

    const entityId = routeId ?? idOf(result);
    // Se relee de la base dentro de la transacción: la respuesta puede omitir o
    // formatear campos.
    const after = entityId ? await source.load(entityId) : null;
    const changes = before && after ? diffFirstLevel(before, after) : { before, after };

    try {
      await this.audit.record({
        userId: request.user?.id ?? null,
        role: request.user?.role ?? null,
        type: options.type,
        action: options.action,
        entity: options.entity,
        entityId: entityId ?? null,
        detail: resolveAuditDetail(options, request.body),
        dataBefore: changes.before,
        dataAfter: changes.after,
      });
    } catch (error) {
      throw new AuditWriteError(error);
    }
    return result;
  }
}
