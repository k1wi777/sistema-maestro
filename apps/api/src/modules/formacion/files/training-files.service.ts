import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AuditLogType,
  dispositionForContentType,
  ModuleFilePurpose,
  MODULE_FILE_POLICY,
  StoredFileStatus,
  type ModuleFileUploadResult,
  type RequestModuleFileUploadInput,
  type SignedUrlResult,
  type TrainingModule,
} from '@gns/shared';
import { diffFirstLevel } from '../../../core/audit/audit-data';
import type { RequestUser } from '../../../core/audit/request-user';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../shared/database/transaction-runner';
import { OBJECT_STORAGE, type ObjectStorage } from '../../../shared/storage/object-storage';
import { AuditLogService } from '../../auditoria/audit-log.service';
import { StorageUnavailableError } from '../../../shared/storage/storage-unavailable.error';
import { TrainingContentService } from '../content/training-content.service';
import {
  TRAINING_PLAN_REPOSITORY,
  type TrainingPlanRepository,
} from '../plans/training-plan.repository';
import { TrainingPlansService } from '../plans/training-plans.service';
import { TrainingRouteService } from '../route/training-route.service';
import {
  TRAINING_FILES_REPOSITORY,
  type StoredFileRecord,
  type TrainingFilesRepository,
} from './training-files.repository';

const MODULE_NOT_FOUND = 'Módulo no encontrado';
const FILE_NOT_FOUND = 'El módulo no tiene ese archivo';

/** Clave del objeto: la genera la API, nunca el usuario. */
export const moduleObjectKeyPrefix = (moduleId: string): string => `formacion/modulos/${moduleId}/`;

/**
 * Video y presentación de un módulo como archivo (coordinación) y su URL firmada (coordinación y
 * docente). La subida es en dos pasos: solicitud con URL de PUT y confirmación contra el
 * almacenamiento. El navegador nunca recibe credenciales ni claves de objeto, solo URL con
 * caducidad.
 */
@Injectable()
export class TrainingFilesService {
  private readonly logger = new Logger(TrainingFilesService.name);

  constructor(
    @Inject(TRAINING_FILES_REPOSITORY) private readonly files: TrainingFilesRepository,
    @Inject(TRAINING_PLAN_REPOSITORY) private readonly plans: TrainingPlanRepository,
    @Inject(TRANSACTION_RUNNER) private readonly transactions: TransactionRunner,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly planService: TrainingPlansService,
    private readonly route: TrainingRouteService,
    private readonly content: TrainingContentService,
    private readonly audit: AuditLogService,
  ) {}

  /** Registra el archivo `pendiente` y firma la subida; el tipo y el tamaño ya los validó el esquema (R1, R2). */
  async requestUpload(
    user: RequestUser,
    moduleId: string,
    input: RequestModuleFileUploadInput,
  ): Promise<ModuleFileUploadResult> {
    await this.requireModule(moduleId);
    const fileId = randomUUID();
    const objectKey = `${moduleObjectKeyPrefix(moduleId)}${fileId}`;
    const upload = await this.transactions.run(async () => {
      await this.files.createPending({
        id: fileId,
        objectKey,
        purpose: MODULE_FILE_POLICY[input.purpose].storedPurpose,
        contentType: input.contentType,
        size: input.size,
        originalName: input.name,
        uploadedById: user.id,
      });
      // La firma es local: si falla, la fila no se guarda.
      return this.storage.presignPut(objectKey, input.contentType, input.size);
    });
    return { fileId, upload };
  }

  /**
   * Comprueba en el almacenamiento que el objeto existe tal como se declaró y lo asocia al módulo,
   * sustituyendo el archivo o el enlace previo (R3). Si no coincide, queda `rechazado` y es 409 (R4).
   */
  async confirm(user: RequestUser, moduleId: string, fileId: string): Promise<TrainingModule> {
    await this.requireModule(moduleId);
    const file = await this.files.findFile(fileId);
    if (!file || !file.objectKey.startsWith(moduleObjectKeyPrefix(moduleId))) {
      throw new NotFoundException('Archivo no encontrado en este módulo');
    }
    if (file.status !== StoredFileStatus.Pending) {
      throw new ConflictException('El archivo ya fue confirmado o rechazado');
    }

    const info = await this.storage.head(file.objectKey);
    if (info?.size !== file.size || info.contentType !== file.contentType) {
      await this.reject(file);
      throw new ConflictException(
        'El archivo subido no existe o no coincide con lo declarado: solicita una nueva subida',
      );
    }

    const purpose = this.purposeOf(file);
    // Transacción corta, sin red: asociar el archivo y dejar la fila de bitácora (si una falla, ninguna).
    await this.transactions.run(async () => {
      await this.plans.lockModule(moduleId);
      // Con el módulo bloqueado se relee el estado: una confirmación simultánea gana.
      if ((await this.files.findFile(fileId))?.status !== StoredFileStatus.Pending) {
        throw new ConflictException('El archivo ya fue confirmado o rechazado');
      }
      const before = await this.content.moduleForAudit(moduleId);
      await this.files.markAvailable(fileId, new Date());
      await this.files.attach(moduleId, purpose, fileId);
      const after = await this.content.moduleForAudit(moduleId);
      const changes = before && after ? diffFirstLevel(before, after) : { before, after };
      await this.audit.record({
        userId: user.id,
        role: user.role,
        type: AuditLogType.Training,
        action: 'Adjuntó un archivo a un módulo de formación',
        entity: 'modulo_formacion',
        entityId: moduleId,
        dataBefore: changes.before,
        dataAfter: changes.after,
      });
    });
    return this.planService.getModule(moduleId);
  }

  /** Desasocia el archivo del módulo; el registro y el objeto almacenado se conservan (R5). */
  remove(moduleId: string, purpose: ModuleFilePurpose): Promise<TrainingModule> {
    return this.transactions.run(async () => {
      await this.requireModule(moduleId);
      await this.plans.lockModule(moduleId);
      if (!(await this.files.findModuleFile(moduleId, purpose))) {
        throw new NotFoundException(FILE_NOT_FOUND);
      }
      await this.files.detach(moduleId, purpose);
      return this.planService.getModule(moduleId);
    });
  }

  /** URL firmada para coordinación: cualquier módulo (R8). */
  async urlForCoordination(moduleId: string, purpose: ModuleFilePurpose): Promise<SignedUrlResult> {
    await this.requireModule(moduleId);
    return this.signedUrl(moduleId, purpose);
  }

  /** URL firmada para el docente: solo los módulos de su ruta (R7); lo demás es 404. */
  async urlForTeacher(
    user: RequestUser,
    moduleId: string,
    purpose: ModuleFilePurpose,
  ): Promise<SignedUrlResult> {
    await this.route.requireVisibleModule(user, moduleId);
    return this.signedUrl(moduleId, purpose);
  }

  /** `inline` (video, PDF, imágenes) o `attachment` (PPTX): la caducidad la decide el almacenamiento. */
  private async signedUrl(moduleId: string, purpose: ModuleFilePurpose): Promise<SignedUrlResult> {
    const file = await this.files.findModuleFile(moduleId, purpose);
    if (file?.status !== StoredFileStatus.Available) {
      throw new NotFoundException(FILE_NOT_FOUND);
    }
    return this.storage.presignGet(file.objectKey, {
      fileName: file.originalName ?? 'archivo',
      disposition: dispositionForContentType(file.contentType),
      contentType: file.contentType,
    });
  }

  private async requireModule(moduleId: string): Promise<void> {
    if (!(await this.plans.findModule(moduleId))) {
      throw new NotFoundException(MODULE_NOT_FOUND);
    }
  }

  private purposeOf(file: StoredFileRecord): ModuleFilePurpose {
    return file.purpose === MODULE_FILE_POLICY[ModuleFilePurpose.Video].storedPurpose
      ? ModuleFilePurpose.Video
      : ModuleFilePurpose.Presentation;
  }

  /**
   * Un archivo rechazado nunca se asoció a nada y puede ser inválido: se quita del almacenamiento.
   * Si el almacenamiento falla aquí, el registro ya quedó `rechazado` y la respuesta sigue siendo 409.
   */
  private async reject(file: StoredFileRecord): Promise<void> {
    await this.files.markRejected(file.id);
    try {
      await this.storage.remove(file.objectKey);
    } catch (error) {
      if (!(error instanceof StorageUnavailableError)) {
        throw error;
      }
      this.logger.warn({ msg: 'No se pudo quitar un objeto rechazado', fileId: file.id });
    }
  }
}
