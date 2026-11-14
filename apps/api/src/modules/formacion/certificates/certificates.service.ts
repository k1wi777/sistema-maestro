import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditLogType,
  CertificateKind,
  StoredFilePurpose,
  type CertificateList,
  type CertificateSummary,
  type CertificateVerification,
  type SignedUrlResult,
} from '@gns/shared';
import { diffFirstLevel } from '../../../core/audit/audit-data';
import type { RequestUser } from '../../../core/audit/request-user';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../shared/database/transaction-runner';
import { OBJECT_STORAGE, type ObjectStorage } from '../../../shared/storage/object-storage';
import { AuditLogService } from '../../auditoria/audit-log.service';
import { UsersService } from '../../identidad/users/users.service';
import {
  TRAINING_FILES_REPOSITORY,
  type StoredFileRecord,
  type TrainingFilesRepository,
} from '../files/training-files.repository';
import {
  TRAINING_PLAN_REPOSITORY,
  type TrainingPlanRepository,
} from '../plans/training-plan.repository';
import { TrainingMilestones } from '../progress/training-milestones';
import {
  TRAINING_PROGRESS_REPOSITORY,
  type TrainingProgressRepository,
} from '../progress/training-progress.repository';
import { TrainingRouteService } from '../route/training-route.service';
import { generateCertificateCode, normalizeCertificateCode } from './certificate-code';
import { renderCertificatePdf } from './certificate-pdf';
import {
  CERTIFICATES_REPOSITORY,
  type CertificateRecord,
  type CertificatesRepository,
} from './certificates.repository';

/** Choques del código aleatorio de 80 bits: prácticamente imposibles, pero se reintenta. */
const MAX_CODE_ATTEMPTS = 3;

/** Título del certificado de la ruta completa. */
export const ROUTE_CERTIFICATE_TITLE = 'Ruta de formación GNS';

const PDF_CONTENT_TYPE = 'application/pdf';
const PDF_FILE_NAME = 'certificado-gns.pdf';
const NOT_FOUND = 'Certificado no encontrado';

const kindOf = (record: CertificateRecord): CertificateKind =>
  record.moduleId === null ? CertificateKind.Route : CertificateKind.Module;

const toSummary = (record: CertificateRecord): CertificateSummary => ({
  id: record.id,
  kind: kindOf(record),
  title: record.title,
  planName: record.planName,
  code: record.code,
  issuedAt: record.issuedAt,
});

/**
 * Certificados verificables de la formación. La emisión es solo base de datos y corre en la misma
 * transacción que la terminación del módulo; el PDF se genera y guarda en la primera descarga y
 * nunca se regenera.
 */
@Injectable()
export class CertificatesService {
  constructor(
    @Inject(CERTIFICATES_REPOSITORY) private readonly certificates: CertificatesRepository,
    @Inject(TRAINING_FILES_REPOSITORY) private readonly files: TrainingFilesRepository,
    @Inject(TRAINING_PLAN_REPOSITORY) private readonly plans: TrainingPlanRepository,
    @Inject(TRAINING_PROGRESS_REPOSITORY) private readonly progress: TrainingProgressRepository,
    @Inject(TRANSACTION_RUNNER) private readonly transactions: TransactionRunner,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly route: TrainingRouteService,
    private readonly users: UsersService,
    private readonly milestones: TrainingMilestones,
    private readonly audit: AuditLogService,
  ) {}

  // ---------- Emisión ----------

  /**
   * Emite el certificado del módulo terminado y, si con él queda terminada toda la ruta del
   * docente, el de ruta completa (R12, R13). Idempotente: una marca repetida no emite otro.
   * Si falla, falla la terminación entera: no hay módulo terminado sin su certificado.
   */
  async issueForModule(user: RequestUser, moduleId: string, completedAt: Date): Promise<void> {
    const module = await this.plans.findModule(moduleId);
    if (!module) {
      return;
    }
    const plan = await this.plans.findPlan(module.planId);
    const teacher = await this.users.get(user.id);
    const snapshot = { teacherName: teacher.fullName, issuedAt: completedAt };

    await this.issue(user, {
      ...snapshot,
      moduleId,
      kind: CertificateKind.Module,
      title: module.title,
      planName: plan?.name ?? null,
    });
    if (await this.routeIsComplete(user.id)) {
      await this.issue(user, {
        ...snapshot,
        moduleId: null,
        kind: CertificateKind.Route,
        title: ROUTE_CERTIFICATE_TITLE,
        planName: null,
      });
    }
  }

  /** Todos los módulos activos de la ruta vigente del docente están terminados (D2). */
  private async routeIsComplete(teacherId: string): Promise<boolean> {
    const moduleIds = await this.route.routeModuleIds(teacherId);
    if (moduleIds.length === 0) {
      return false;
    }
    const progress = await this.progress.listModuleProgress(teacherId, moduleIds);
    const completed = new Set(
      progress.filter((item) => item.completedAt !== null).map((item) => item.moduleId),
    );
    return moduleIds.every((id) => completed.has(id));
  }

  private async issue(
    user: RequestUser,
    data: {
      moduleId: string | null;
      kind: CertificateKind;
      teacherName: string;
      title: string;
      planName: string | null;
      issuedAt: Date;
    },
  ): Promise<void> {
    if (await this.certificates.findByTeacherAndModule(user.id, data.moduleId)) {
      return;
    }
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const id = randomUUID();
      const inserted = await this.certificates.insertIfAbsent({
        id,
        teacherId: user.id,
        moduleId: data.moduleId,
        code: generateCertificateCode(),
        issuedAt: data.issuedAt,
        teacherName: data.teacherName,
        title: data.title,
        planName: data.planName,
      });
      if (inserted) {
        await this.milestones.certificateIssued(user, id, data.kind, data.moduleId);
        return;
      }
      // Sin fila nueva: o el certificado ya existía (otra petición ganó) o el código chocó.
      if (await this.certificates.findByTeacherAndModule(user.id, data.moduleId)) {
        return;
      }
    }
    throw new Error('No se pudo generar un código de verificación único');
  }

  // ---------- Lectura ----------

  /** Certificados de un docente, del más reciente al más antiguo (R17, R18). */
  async listFor(teacherId: string): Promise<CertificateList> {
    return { items: (await this.certificates.listByTeacher(teacherId)).map(toSummary) };
  }

  /** Certificado para la bitácora: nunca el código ni claves de objeto (R25). */
  async certificateForAudit(id: string): Promise<Record<string, unknown> | null> {
    const record = await this.certificates.findById(id);
    return record
      ? {
          kind: kindOf(record),
          title: record.title,
          planName: record.planName,
          issuedAt: record.issuedAt,
          hasPdf: record.fileId !== null,
        }
      : null;
  }

  // ---------- Descarga ----------

  /** Descarga del propio certificado: uno ajeno es 404 (R17). Deja un hito del docente. */
  async downloadOwn(user: RequestUser, certificateId: string): Promise<SignedUrlResult> {
    const record = await this.certificates.findById(certificateId);
    if (record?.teacherId !== user.id) {
      throw new NotFoundException(NOT_FOUND);
    }
    const url = await this.signedPdfUrl(record);
    await this.milestones.certificateDownloaded(user, record.id, kindOf(record));
    return url;
  }

  /**
   * Descarga de coordinación. El PDF se genera y sube fuera de toda transacción; la bitácora (con
   * el estado antes y después, sin código ni claves) se escribe al final en una transacción corta.
   */
  async downloadAny(user: RequestUser, certificateId: string): Promise<SignedUrlResult> {
    const record = await this.certificates.findById(certificateId);
    if (!record) {
      throw new NotFoundException(NOT_FOUND);
    }
    const before = await this.certificateForAudit(certificateId);
    const url = await this.signedPdfUrl(record);
    const after = await this.certificateForAudit(certificateId);
    const changes = before && after ? diffFirstLevel(before, after) : { before, after };
    await this.transactions.run(() =>
      this.audit.record({
        userId: user.id,
        role: user.role,
        type: AuditLogType.Training,
        action: 'Descargó el certificado de un docente',
        entity: 'certificado',
        entityId: certificateId,
        dataBefore: changes.before,
        dataAfter: changes.after,
      }),
    );
    return url;
  }

  private async signedPdfUrl(record: CertificateRecord): Promise<SignedUrlResult> {
    const file = await this.ensurePdf(record);
    return this.storage.presignGet(file.objectKey, {
      fileName: PDF_FILE_NAME,
      disposition: 'attachment',
      contentType: PDF_CONTENT_TYPE,
    });
  }

  /**
   * El PDF se genera la primera vez y se reutiliza (R15). Se sube con la clave fija
   * `certificados/<id>.pdf` y se registra con `ON CONFLICT DO NOTHING`: dos descargas simultáneas
   * escriben el mismo objeto y solo una fija `archivo_id`; la otra usa el archivo ya fijado.
   */
  private async ensurePdf(record: CertificateRecord): Promise<StoredFileRecord> {
    const existing = record.fileId ? await this.files.findFile(record.fileId) : null;
    if (existing) {
      return existing;
    }
    const pdf = await renderCertificatePdf({
      teacherName: record.teacherName,
      kind: kindOf(record),
      title: record.title,
      planName: record.planName,
      issuedAt: record.issuedAt,
      code: record.code,
    });
    const objectKey = `certificados/${record.id}.pdf`;
    await this.storage.put(objectKey, pdf, PDF_CONTENT_TYPE);

    return this.transactions.run(async () => {
      await this.files.createAvailableIfAbsent({
        id: randomUUID(),
        objectKey,
        purpose: StoredFilePurpose.Certificate,
        contentType: PDF_CONTENT_TYPE,
        size: pdf.length,
        originalName: null,
        uploadedById: null,
      });
      const file = await this.files.findByObjectKey(objectKey);
      if (!file) {
        throw new Error('No se pudo registrar el PDF del certificado');
      }
      await this.certificates.setFileIfAbsent(record.id, file.id);
      // Si otra descarga se adelantó, la fila ya apunta a su archivo (misma clave de objeto).
      const current = await this.certificates.findById(record.id);
      const fixed = current?.fileId ? await this.files.findFile(current.fileId) : null;
      return fixed ?? file;
    });
  }

  // ---------- Verificación pública (D1) ----------

  /**
   * Confirma un código con lo que el PDF ya muestra. Un formato inválido y un código inexistente
   * responden igual (404, sin pistas); solo los códigos que existen quedan en la bitácora, sin
   * usuario, para que los intentos fallidos no la inunden.
   */
  async verify(rawCode: string): Promise<CertificateVerification> {
    const code = normalizeCertificateCode(rawCode);
    const record = code ? await this.certificates.findByCode(code) : null;
    if (!record) {
      throw new NotFoundException(NOT_FOUND);
    }
    await this.audit.record({
      userId: null,
      role: null,
      type: AuditLogType.Training,
      action: 'Verificó un certificado',
      entity: 'certificado',
      entityId: record.id,
      dataAfter: { kind: kindOf(record) },
    });
    return {
      valid: true,
      teacherName: record.teacherName,
      kind: kindOf(record),
      title: record.title,
      planName: record.planName,
      issuedAt: record.issuedAt,
    };
  }
}
