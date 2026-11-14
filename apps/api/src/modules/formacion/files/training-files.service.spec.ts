import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { PPTX_CONTENT_TYPE, StoredFilePurpose, StoredFileStatus } from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import type { TransactionRunner } from '../../../shared/database/transaction-runner';
import { InMemoryObjectStorage } from '../../../shared/storage/in-memory-object-storage';
import { StorageUnavailableError } from '../../../shared/storage/storage-unavailable.error';
import type { TrainingPlanRepository } from '../plans/training-plan.repository';
import type { TrainingPlansService } from '../plans/training-plans.service';
import type { TrainingRouteService } from '../route/training-route.service';
import type {
  NewStoredFile,
  StoredFileRecord,
  TrainingFilesRepository,
} from './training-files.repository';
import { TrainingFilesService } from './training-files.service';

const MODULE_ID = '00000000-0000-4000-8000-000000000003';
const OTHER_MODULE_ID = '00000000-0000-4000-8000-000000000004';
const USER = { id: '00000000-0000-4000-8000-000000000009', role: 'coordinador' } as RequestUser;

/** Repository en memoria: `attach` sustituye el archivo y quita el enlace del mismo propósito. */
class FakeFilesRepository implements TrainingFilesRepository {
  readonly files = new Map<string, StoredFileRecord>();
  readonly attached = new Map<string, string>(); // `${moduleId}:${purpose}` -> fileId
  readonly clearedLinks: string[] = [];

  createPending(file: NewStoredFile): Promise<StoredFileRecord> {
    const record: StoredFileRecord = {
      id: file.id,
      objectKey: file.objectKey,
      purpose: file.purpose,
      contentType: file.contentType,
      size: file.size,
      originalName: file.originalName,
      status: StoredFileStatus.Pending,
    };
    this.files.set(file.id, record);
    return Promise.resolve(record);
  }

  createAvailableIfAbsent(): Promise<void> {
    return Promise.resolve();
  }

  findByObjectKey(): Promise<StoredFileRecord | null> {
    return Promise.resolve(null);
  }

  findFile(id: string): Promise<StoredFileRecord | null> {
    return Promise.resolve(this.files.get(id) ?? null);
  }

  findModuleFile(moduleId: string, purpose: string): Promise<StoredFileRecord | null> {
    const id = this.attached.get(`${moduleId}:${purpose}`);
    return Promise.resolve(id ? (this.files.get(id) ?? null) : null);
  }

  markAvailable(id: string): Promise<void> {
    this.set(id, StoredFileStatus.Available);
    return Promise.resolve();
  }

  markRejected(id: string): Promise<void> {
    this.set(id, StoredFileStatus.Rejected);
    return Promise.resolve();
  }

  attach(moduleId: string, purpose: string, fileId: string): Promise<void> {
    this.attached.set(`${moduleId}:${purpose}`, fileId);
    this.clearedLinks.push(`${moduleId}:${purpose}`);
    return Promise.resolve();
  }

  detach(moduleId: string, purpose: string): Promise<void> {
    this.attached.delete(`${moduleId}:${purpose}`);
    return Promise.resolve();
  }

  private set(id: string, status: StoredFileStatus): void {
    const file = this.files.get(id);
    if (file) {
      this.files.set(id, { ...file, status });
    }
  }
}

function setup() {
  const repository = new FakeFilesRepository();
  const storage = new InMemoryObjectStorage();
  const plans = {
    findModule: jest.fn().mockResolvedValue({ id: MODULE_ID }),
    lockModule: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<TrainingPlanRepository>;
  const planService = {
    getModule: jest.fn().mockResolvedValue({ id: MODULE_ID }),
  } as unknown as jest.Mocked<TrainingPlansService>;
  const route = {
    requireVisibleModule: jest.fn().mockResolvedValue({}),
  } as unknown as jest.Mocked<TrainingRouteService>;
  const record = jest.fn().mockResolvedValue(undefined);
  const transactions: TransactionRunner = { run: (fn) => fn() };
  const service = new TrainingFilesService(
    repository,
    plans,
    transactions,
    storage,
    planService,
    route,
    { moduleForAudit: jest.fn().mockResolvedValue({ videoFileId: null }) } as never,
    { record } as never,
  );
  return { service, repository, storage, plans, route, record };
}

const VIDEO = {
  purpose: 'video',
  name: 'clase.mp4',
  contentType: 'video/mp4',
  size: 1000,
} as const;

describe('TrainingFilesService', () => {
  describe('requestUpload', () => {
    it('registers a pending file and returns a signed PUT without exposing the object key', async () => {
      const { service, repository } = setup();

      const result = await service.requestUpload(USER, MODULE_ID, VIDEO);

      const file = repository.files.get(result.fileId);
      expect(file).toMatchObject({
        purpose: StoredFilePurpose.ModuleVideo,
        status: StoredFileStatus.Pending,
        size: 1000,
        originalName: 'clase.mp4',
      });
      expect(file?.objectKey).toBe(`formacion/modulos/${MODULE_ID}/${result.fileId}`);
      expect(result.upload.method).toBe('PUT');
      expect(result.upload.headers).toEqual({ 'Content-Type': 'video/mp4' });
      expect(Object.keys(result)).toEqual(['fileId', 'upload']);
    });

    it('does not register anything when the module does not exist', async () => {
      const { service, repository, plans } = setup();
      plans.findModule.mockResolvedValue(null);

      await expect(service.requestUpload(USER, MODULE_ID, VIDEO)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.files.size).toBe(0);
    });
  });

  describe('confirm', () => {
    async function pending(
      ctx: ReturnType<typeof setup>,
      input: Parameters<TrainingFilesService['requestUpload']>[2] = VIDEO,
    ) {
      const { fileId } = await ctx.service.requestUpload(USER, MODULE_ID, input);
      const file = ctx.repository.files.get(fileId) as StoredFileRecord;
      return file;
    }

    it('marks the file available and attaches it, replacing the previous one', async () => {
      const ctx = setup();
      const first = await pending(ctx);
      ctx.storage.simulateUpload(first.objectKey, 'video/mp4', 1000);
      await ctx.service.confirm(USER, MODULE_ID, first.id);
      const second = await pending(ctx);
      ctx.storage.simulateUpload(second.objectKey, 'video/mp4', 1000);

      await ctx.service.confirm(USER, MODULE_ID, second.id);

      expect(ctx.repository.files.get(second.id)?.status).toBe(StoredFileStatus.Available);
      expect(ctx.repository.attached.get(`${MODULE_ID}:video`)).toBe(second.id);
      // El archivo sustituido y su objeto se conservan.
      expect(ctx.repository.files.get(first.id)?.status).toBe(StoredFileStatus.Available);
      expect(ctx.storage.removed).toEqual([]);
    });

    it('records the audit entry in the same short transaction that attaches the file', async () => {
      const ctx = setup();
      const file = await pending(ctx);
      ctx.storage.simulateUpload(file.objectKey, 'video/mp4', 1000);

      await ctx.service.confirm(USER, MODULE_ID, file.id);

      expect(ctx.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER.id,
          action: 'Adjuntó un archivo a un módulo de formación',
          entityId: MODULE_ID,
        }),
      );
      expect(JSON.stringify(ctx.record.mock.calls)).not.toContain(file.objectKey);
    });

    it.each([
      ['the object does not exist', undefined],
      ['the size differs', { type: 'video/mp4', size: 999 }],
      ['the content type differs', { type: 'video/webm', size: 1000 }],
    ])('rejects with 409 and removes the object when %s', async (_name, uploaded) => {
      const ctx = setup();
      const file = await pending(ctx);
      if (uploaded) {
        ctx.storage.simulateUpload(file.objectKey, uploaded.type, uploaded.size);
      }

      await expect(ctx.service.confirm(USER, MODULE_ID, file.id)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(ctx.repository.files.get(file.id)?.status).toBe(StoredFileStatus.Rejected);
      expect(ctx.repository.attached.size).toBe(0);
      expect(ctx.storage.removed).toEqual([file.objectKey]);
    });

    it('still answers 409 when removing a rejected object fails', async () => {
      const ctx = setup();
      const file = await pending(ctx);
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      jest.spyOn(ctx.storage, 'remove').mockRejectedValue(new StorageUnavailableError());

      await expect(ctx.service.confirm(USER, MODULE_ID, file.id)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(ctx.repository.files.get(file.id)?.status).toBe(StoredFileStatus.Rejected);
    });

    it('answers 409 for a file that is not pending and 404 for a file of another module', async () => {
      const ctx = setup();
      const file = await pending(ctx);
      ctx.storage.simulateUpload(file.objectKey, 'video/mp4', 1000);
      await ctx.service.confirm(USER, MODULE_ID, file.id);

      await expect(ctx.service.confirm(USER, MODULE_ID, file.id)).rejects.toBeInstanceOf(
        ConflictException,
      );
      ctx.plans.findModule.mockResolvedValue({ id: OTHER_MODULE_ID } as never);
      await expect(ctx.service.confirm(USER, OTHER_MODULE_ID, file.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('leaves the database untouched when the storage is down', async () => {
      const ctx = setup();
      const file = await pending(ctx);
      ctx.storage.unavailable = true;

      await expect(ctx.service.confirm(USER, MODULE_ID, file.id)).rejects.toBeInstanceOf(
        StorageUnavailableError,
      );
      expect(ctx.repository.files.get(file.id)?.status).toBe(StoredFileStatus.Pending);
    });
  });

  describe('remove and urls', () => {
    async function available(ctx: ReturnType<typeof setup>, contentType = 'video/mp4') {
      const purpose = contentType === 'video/mp4' ? 'video' : 'presentacion';
      const { fileId } = await ctx.service.requestUpload(USER, MODULE_ID, {
        purpose,
        name: 'archivo.bin',
        contentType,
        size: 10,
      });
      const file = ctx.repository.files.get(fileId) as StoredFileRecord;
      ctx.storage.simulateUpload(file.objectKey, contentType, 10);
      await ctx.service.confirm(USER, MODULE_ID, fileId);
      return { file, purpose } as const;
    }

    it('detaches the file but keeps the record and the object', async () => {
      const ctx = setup();
      const { file } = await available(ctx);

      await ctx.service.remove(MODULE_ID, 'video');

      expect(ctx.repository.attached.size).toBe(0);
      expect(ctx.repository.files.get(file.id)?.status).toBe(StoredFileStatus.Available);
      expect(ctx.storage.objects.has(file.objectKey)).toBe(true);
      await expect(ctx.service.remove(MODULE_ID, 'video')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('signs inline for video and attachment for PPTX, with the right expiry', async () => {
      const ctx = setup();
      await available(ctx);
      await available(ctx, PPTX_CONTENT_TYPE);

      const video = await ctx.service.urlForCoordination(MODULE_ID, 'video');
      const pptx = await ctx.service.urlForCoordination(MODULE_ID, 'presentacion');

      expect(video.url).toContain('/inline/');
      expect(pptx.url).toContain('/attachment/');
      expect(video.expiresAt.getTime()).toBeGreaterThan(pptx.expiresAt.getTime());
    });

    it('answers 404 when the module has no file of that purpose', async () => {
      const ctx = setup();

      await expect(ctx.service.urlForCoordination(MODULE_ID, 'video')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lets a teacher in only through the route visibility rule', async () => {
      const ctx = setup();
      await available(ctx);
      ctx.route.requireVisibleModule.mockRejectedValue(new NotFoundException('fuera de ruta'));

      await expect(ctx.service.urlForTeacher(USER, MODULE_ID, 'video')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      ctx.route.requireVisibleModule.mockResolvedValue({} as never);
      await expect(ctx.service.urlForTeacher(USER, MODULE_ID, 'video')).resolves.toHaveProperty(
        'url',
      );
    });
  });
});
