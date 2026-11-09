import { randomUUID } from 'node:crypto';
import { ConflictException, Controller, Get, Post } from '@nestjs/common';
import { AuditLogType } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../src/core/audit/audited.decorator';
import { PrismaService } from '../../../src/shared/database/prisma.service';
import { FaqExampleAuditSnapshot } from '../example/faq-example.audit-snapshot';
import { FaqExampleDto } from '../example/faq-example.dto';
import { BigSnapshot, FIXED_ID, SecretSnapshot } from './failure.snapshots';

export const FAILING_CATEGORY = 'int-falla-negocio';
export const BAD_AUDIT_CATEGORY = 'int-falla-bitacora';

const faqData = (category: string) => ({
  category,
  question: 'Pregunta de prueba',
  answer: 'Respuesta',
  isActive: false,
});

@Controller('failures')
export class FailureController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('boom')
  boom(): never {
    throw new Error('detalle interno SELECT * FROM usuario WHERE correo = x@y.z');
  }

  @Get('unique')
  async unique() {
    const email = `${randomUUID()}@unicidad.test`;
    // Una transacción propia para no dejar filas.
    await this.prisma.$transaction(async (tx) => {
      const data = {
        fullName: 'Prueba',
        institutionalEmail: email,
        role: 'docente',
        status: 'activo',
      };
      await tx.user.create({ data });
      await tx.user.create({ data });
    });
  }

  @Get('foreign-key')
  async foreignKey() {
    await this.prisma.faqEntry.create({
      data: { ...faqData('int-fk'), updatedById: randomUUID() },
    });
  }

  @Get('check')
  async check() {
    await this.prisma.user.create({
      data: {
        fullName: 'Prueba',
        institutionalEmail: `${randomUUID()}@check.test`,
        role: 'rol-inexistente',
        status: 'activo',
      },
    });
  }

  @Get('undeclared')
  @ZodResponse({ type: FaqExampleDto })
  undeclared() {
    return {
      id: randomUUID(),
      category: 'c',
      question: 'q',
      answer: 'a',
      isActive: true,
      createdAt: new Date(),
      internalNote: 'no debe salir',
    };
  }

  /** Escribe una fila de negocio y falla: la transacción debe revertirla y no auditar. */
  @Post('failing-audited')
  @Audited({
    type: AuditLogType.Assistant,
    action: 'Acción que falla',
    entity: 'pregunta_frecuente',
    snapshot: FaqExampleAuditSnapshot,
  })
  async failingAudited() {
    await this.prisma.db.faqEntry.create({ data: faqData(FAILING_CATEGORY) });
    throw new ConflictException('La acción falló después de escribir');
  }

  /** `tipo` fuera del CHECK: falla el INSERT en la bitácora y todo se revierte (R17). */
  @Post('bad-audit')
  @Audited({
    type: 'tipo-invalido' as AuditLogType,
    action: 'Acción con bitácora rota',
    entity: 'pregunta_frecuente',
    snapshot: FaqExampleAuditSnapshot,
  })
  async badAudit() {
    const created = await this.prisma.db.faqEntry.create({ data: faqData(BAD_AUDIT_CATEGORY) });
    return { id: created.id };
  }

  @Post('audited-secret')
  @Audited({
    type: AuditLogType.Assistant,
    action: 'Acción con secretos',
    entity: 'pregunta_frecuente',
    snapshot: SecretSnapshot,
  })
  auditedSecret() {
    return { id: FIXED_ID };
  }

  @Post('audited-big')
  @Audited({
    type: AuditLogType.Assistant,
    action: 'Acción con datos grandes',
    entity: 'pregunta_frecuente',
    snapshot: BigSnapshot,
  })
  auditedBig() {
    return { id: FIXED_ID };
  }
}
