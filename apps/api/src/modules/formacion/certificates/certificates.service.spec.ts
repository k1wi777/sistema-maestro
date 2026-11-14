import { NotFoundException } from '@nestjs/common';
import { CertificateKind, StoredFileStatus, UserRole } from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import type { TransactionRunner } from '../../../shared/database/transaction-runner';
import { InMemoryObjectStorage } from '../../../shared/storage/in-memory-object-storage';
import type { AuditEntry, AuditLogService } from '../../auditoria/audit-log.service';
import type { UsersService } from '../../identidad/users/users.service';
import type {
  NewStoredFile,
  StoredFileRecord,
  TrainingFilesRepository,
} from '../files/training-files.repository';
import type { TrainingPlanRepository } from '../plans/training-plan.repository';
import type { TrainingMilestones } from '../progress/training-milestones';
import type { TrainingProgressRepository } from '../progress/training-progress.repository';
import type { TrainingRouteService } from '../route/training-route.service';
import type {
  CertificateRecord,
  CertificatesRepository,
  NewCertificate,
} from './certificates.repository';
import { CertificatesService, ROUTE_CERTIFICATE_TITLE } from './certificates.service';

const TEACHER = '00000000-0000-4000-8000-000000000001';
const MODULE_A = '00000000-0000-4000-8000-0000000000a1';
const MODULE_B = '00000000-0000-4000-8000-0000000000b1';
const PLAN = '00000000-0000-4000-8000-0000000000c1';
const USER: RequestUser = { id: TEACHER, role: UserRole.Teacher, sessionId: 's' };
const DONE = new Date('2026-11-13T15:00:00.000Z');

/** Repository en memoria con las mismas restricciones únicas que la base (código y docente-módulo). */
class FakeCertificates implements CertificatesRepository {
  readonly rows: CertificateRecord[] = [];
  /** Códigos que ya «existen»: simulan un choque con otro certificado. */
  takenCodes: string[] = [];

  insertIfAbsent(c: NewCertificate): Promise<boolean> {
    const duplicate =
      this.takenCodes.includes(c.code) ||
      this.rows.some(
        (row) =>
          row.code === c.code || (row.teacherId === c.teacherId && row.moduleId === c.moduleId),
      );
    if (duplicate) {
      this.takenCodes = this.takenCodes.filter((code) => code !== c.code);
      return Promise.resolve(false);
    }
    this.rows.push({ ...c, fileId: null });
    return Promise.resolve(true);
  }

  findByTeacherAndModule(teacherId: string, moduleId: string | null) {
    return Promise.resolve(
      this.rows.find((row) => row.teacherId === teacherId && row.moduleId === moduleId) ?? null,
    );
  }

  findById(id: string) {
    return Promise.resolve(this.rows.find((row) => row.id === id) ?? null);
  }

  listByTeacher(teacherId: string): Promise<CertificateRecord[]> {
    return Promise.resolve(this.rows.filter((row) => row.teacherId === teacherId));
  }

  findByCode(code: string) {
    return Promise.resolve(this.rows.find((row) => row.code === code) ?? null);
  }

  setFileIfAbsent(certificateId: string, fileId: string): Promise<boolean> {
    const row = this.rows.find((candidate) => candidate.id === certificateId);
    if (!row || row.fileId !== null) {
      return Promise.resolve(false);
    }
    row.fileId = fileId;
    return Promise.resolve(true);
  }
}

class FakeFiles {
  readonly rows = new Map<string, StoredFileRecord>();

  createAvailableIfAbsent(file: NewStoredFile): Promise<void> {
    if (![...this.rows.values()].some((row) => row.objectKey === file.objectKey)) {
      this.rows.set(file.id, { ...file, status: StoredFileStatus.Available });
    }
    return Promise.resolve();
  }

  findByObjectKey(key: string) {
    return Promise.resolve([...this.rows.values()].find((row) => row.objectKey === key) ?? null);
  }

  findFile(id: string) {
    return Promise.resolve(this.rows.get(id) ?? null);
  }
}

function setup(routeModules: string[] = [MODULE_A], completed: string[] = [MODULE_A]) {
  const certificates = new FakeCertificates();
  const plans = {
    findModule: jest.fn((id: string) =>
      Promise.resolve({ id, planId: PLAN, title: `Módulo ${id.slice(-2)}` }),
    ),
    findPlan: jest.fn(() => Promise.resolve({ id: PLAN, name: 'Inducción' })),
  } as unknown as jest.Mocked<TrainingPlanRepository>;
  const progress = {
    listModuleProgress: jest.fn(() =>
      Promise.resolve(completed.map((moduleId) => ({ moduleId, completedAt: DONE }))),
    ),
  } as unknown as jest.Mocked<TrainingProgressRepository>;
  const route = {
    routeModuleIds: jest.fn(() => Promise.resolve(routeModules)),
  } as unknown as jest.Mocked<TrainingRouteService>;
  const users = {
    get: jest.fn(() => Promise.resolve({ id: TEACHER, fullName: 'Ana Núñez' })),
  } as unknown as jest.Mocked<UsersService>;
  const certificateIssued = jest.fn().mockResolvedValue(undefined);
  const certificateDownloaded = jest.fn().mockResolvedValue(undefined);
  const milestones = { certificateIssued, certificateDownloaded } as unknown as TrainingMilestones;
  const files = new FakeFiles();
  const storage = new InMemoryObjectStorage();
  const record = jest.fn<Promise<void>, [AuditEntry]>().mockResolvedValue(undefined);
  const transactions: TransactionRunner = { run: (fn) => fn() };
  const service = new CertificatesService(
    certificates,
    files as unknown as TrainingFilesRepository,
    plans,
    progress,
    transactions,
    storage,
    route,
    users,
    milestones,
    { record } as unknown as AuditLogService,
  );
  return {
    service,
    certificates,
    certificateIssued,
    certificateDownloaded,
    files,
    storage,
    auditRecord: record,
    route,
  };
}

describe('CertificatesService.issueForModule', () => {
  it('issues the module certificate with a snapshot of teacher, title and plan', async () => {
    const { service, certificates } = setup([MODULE_A, MODULE_B], [MODULE_A]);

    await service.issueForModule(USER, MODULE_A, DONE);

    expect(certificates.rows).toHaveLength(1);
    expect(certificates.rows[0]).toMatchObject({
      teacherId: TEACHER,
      moduleId: MODULE_A,
      teacherName: 'Ana Núñez',
      title: 'Módulo a1',
      planName: 'Inducción',
      issuedAt: DONE,
    });
    expect(certificates.rows[0]?.code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);
  });

  it('issues the route certificate too when the last active module of the route is done', async () => {
    const { service, certificates } = setup([MODULE_A, MODULE_B], [MODULE_A, MODULE_B]);

    await service.issueForModule(USER, MODULE_B, DONE);

    expect(certificates.rows.map((row) => row.moduleId)).toEqual([MODULE_B, null]);
    expect(certificates.rows[1]).toMatchObject({ title: ROUTE_CERTIFICATE_TITLE, planName: null });
  });

  it('does not issue the route certificate while a module of the route is pending', async () => {
    const { service, certificates } = setup([MODULE_A, MODULE_B], [MODULE_A]);

    await service.issueForModule(USER, MODULE_A, DONE);

    expect(certificates.rows.map((row) => row.moduleId)).toEqual([MODULE_A]);
  });

  it('is idempotent: a repeated call issues nothing and records no new milestone', async () => {
    const { service, certificates, certificateIssued } = setup();

    await service.issueForModule(USER, MODULE_A, DONE);
    await service.issueForModule(USER, MODULE_A, DONE);

    expect(certificates.rows).toHaveLength(2); // módulo y ruta, una sola vez cada uno
    expect(certificateIssued).toHaveBeenCalledTimes(2);
  });

  it('records a milestone per certificate without the code', async () => {
    const { service, certificates, certificateIssued } = setup();

    await service.issueForModule(USER, MODULE_A, DONE);

    expect(certificateIssued).toHaveBeenCalledWith(
      USER,
      expect.any(String),
      CertificateKind.Module,
      MODULE_A,
    );
    expect(certificateIssued).toHaveBeenCalledWith(
      USER,
      expect.any(String),
      CertificateKind.Route,
      null,
    );
    for (const row of certificates.rows) {
      expect(JSON.stringify(certificateIssued.mock.calls)).not.toContain(row.code);
    }
  });

  it('retries with another code when the code collides', async () => {
    const { service, certificates } = setup([MODULE_A, MODULE_B], [MODULE_A]);
    const random = jest.requireActual<typeof import('./certificate-code')>('./certificate-code');
    const spy = jest.spyOn(random, 'generateCertificateCode');
    spy.mockReturnValueOnce('AAAA-AAAA-AAAA-AAAA').mockReturnValueOnce('BBBB-BBBB-BBBB-BBBB');
    certificates.takenCodes = ['AAAA-AAAA-AAAA-AAAA'];

    await service.issueForModule(USER, MODULE_A, DONE);

    expect(certificates.rows).toHaveLength(1);
    expect(certificates.rows[0]?.code).toBe('BBBB-BBBB-BBBB-BBBB');
    spy.mockRestore();
  });

  it('fails the whole completion when no unique code can be generated', async () => {
    const { service, certificates } = setup();
    jest.spyOn(certificates, 'insertIfAbsent').mockResolvedValue(false);

    await expect(service.issueForModule(USER, MODULE_A, DONE)).rejects.toThrow(
      'código de verificación único',
    );
  });
});

describe('CertificatesService downloads and verification', () => {
  const OTHER: RequestUser = { ...USER, id: '00000000-0000-4000-8000-0000000000ff' };

  async function issued() {
    const ctx = setup();
    await ctx.service.issueForModule(USER, MODULE_A, DONE);
    const [moduleCertificate] = ctx.certificates.rows;
    return { ...ctx, moduleCertificate: moduleCertificate as CertificateRecord };
  }

  it('generates the PDF once and reuses it on the next download', async () => {
    const { service, files, storage, certificates, moduleCertificate } = await issued();
    const put = jest.spyOn(storage, 'put');

    const first = await service.downloadOwn(USER, moduleCertificate.id);
    const second = await service.downloadOwn(USER, moduleCertificate.id);

    expect(put).toHaveBeenCalledTimes(1);
    expect(files.rows.size).toBe(1);
    expect(certificates.rows[0]?.fileId).not.toBeNull();
    expect(first.url).toContain('/attachment/certificados/');
    expect(second.url).toBe(first.url);
    expect(first.expiresAt).toBeInstanceOf(Date);
    const stored = [...storage.objects.values()][0];
    expect(stored?.contentType).toBe('application/pdf');
    expect(stored?.body?.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('keeps the file that won a simultaneous download', async () => {
    const { service, files, certificates, moduleCertificate } = await issued();

    await Promise.all([
      service.downloadOwn(USER, moduleCertificate.id),
      service.downloadOwn(USER, moduleCertificate.id),
    ]);

    expect(files.rows.size).toBe(1);
    expect([...files.rows.keys()]).toEqual([certificates.rows[0]?.fileId]);
  });

  it('answers 404 for a certificate of another teacher, with no PDF generated', async () => {
    const { service, storage, moduleCertificate } = await issued();

    await expect(service.downloadOwn(OTHER, moduleCertificate.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.downloadOwn(USER, TEACHER)).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.objects.size).toBe(0);
  });

  it('writes the coordination download to the audit log without the code', async () => {
    const { service, auditRecord, moduleCertificate } = await issued();

    await service.downloadAny(USER, moduleCertificate.id);

    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'Descargó el certificado de un docente',
        entityId: moduleCertificate.id,
        dataAfter: { hasPdf: true },
      }),
    );
    expect(JSON.stringify(auditRecord.mock.calls)).not.toContain(moduleCertificate.code);
  });

  it('records the teacher milestone only for the teacher own download', async () => {
    const { service, certificateDownloaded, moduleCertificate } = await issued();

    await service.downloadAny(USER, moduleCertificate.id);
    expect(certificateDownloaded).not.toHaveBeenCalled();

    await service.downloadOwn(USER, moduleCertificate.id);
    expect(certificateDownloaded).toHaveBeenCalledWith(
      USER,
      moduleCertificate.id,
      CertificateKind.Module,
    );
  });

  it('lists only the teacher own certificates, without keys or URLs', async () => {
    const { service, moduleCertificate } = await issued();

    const own = await service.listFor(TEACHER);
    const other = await service.listFor(OTHER.id);

    expect(own.items.map((item) => item.id)).toContain(moduleCertificate.id);
    expect(other.items).toEqual([]);
    expect(Object.keys(own.items[0] ?? {}).sort()).toEqual(
      ['code', 'id', 'issuedAt', 'kind', 'planName', 'title'].sort(),
    );
  });

  it('verifies a code written loosely and returns only what the PDF shows', async () => {
    const { service, moduleCertificate, auditRecord } = await issued();

    const result = await service.verify(moduleCertificate.code.toLowerCase().replaceAll('-', ' '));

    expect(result).toEqual({
      valid: true,
      teacherName: 'Ana Núñez',
      kind: CertificateKind.Module,
      title: moduleCertificate.title,
      planName: 'Inducción',
      issuedAt: DONE,
    });
    expect(auditRecord).toHaveBeenCalledTimes(1);
    const entry = auditRecord.mock.calls[0]?.[0];
    expect(entry).toMatchObject({
      userId: null,
      role: null,
      action: 'Verificó un certificado',
      entityId: moduleCertificate.id,
    });
    expect(JSON.stringify(entry)).not.toContain(moduleCertificate.code);
  });

  it.each(['', 'ZZZZ-ZZZZ-ZZZZ-ZZZZ', 'no es un código', "' OR 1=1 --"])(
    'answers 404 for the code %p and writes nothing to the audit log',
    async (code) => {
      const { service, auditRecord } = await issued();

      await expect(service.verify(code)).rejects.toBeInstanceOf(NotFoundException);
      expect(auditRecord).not.toHaveBeenCalled();
    },
  );

  it('shows no identifier other than the certificate id in the audit snapshot', async () => {
    const { service, moduleCertificate } = await issued();

    const snapshot = await service.certificateForAudit(moduleCertificate.id);

    expect(snapshot).toEqual({
      kind: CertificateKind.Module,
      title: moduleCertificate.title,
      planName: 'Inducción',
      issuedAt: DONE,
      hasPdf: false,
    });
    expect(await service.certificateForAudit(TEACHER)).toBeNull();
  });
});
