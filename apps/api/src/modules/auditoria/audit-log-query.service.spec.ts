import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import { ApiCodedException } from '../../core/http/api-coded.exception';
import { AuditLogQueryService } from './audit-log-query.service';
import type { AuditLogReadRepository, AuditLogRow } from './audit-log-read.repository';
import type { AuditLogService } from './audit-log.service';

const user = { id: 'u-1', role: UserRole.Coordinator, sessionId: 's-1' };

const row = (id: string): AuditLogRow => ({
  id,
  occurredAt: new Date('2026-11-14T15:00:00Z'),
  user: null,
  role: 'desconocido',
  type: 'ingreso',
  action: 'Intento fallido',
  entity: null,
  entityId: null,
  detail: null,
});

function setup(limit = 2) {
  const findPage = jest.fn<ReturnType<AuditLogReadRepository['findPage']>, never>();
  const findById = jest.fn<ReturnType<AuditLogReadRepository['findById']>, never>();
  const findForExport = jest.fn<ReturnType<AuditLogReadRepository['findForExport']>, never>();
  const repository: AuditLogReadRepository = { findPage, findById, findForExport };
  const record = jest.fn().mockResolvedValue(undefined);
  const service = new AuditLogQueryService(
    repository,
    { record } as unknown as AuditLogService,
    limit,
  );
  return { service, findPage, findById, findForExport, record };
}

describe('AuditLogQueryService.list (R4, R6)', () => {
  it('passes the filters, the cursor and the limit to the repository without recording', async () => {
    const { service, findPage, record } = setup();
    findPage.mockResolvedValue({ items: [], nextCursor: null });

    await service.list({ limit: 20, cursor: '9', type: 'ingreso', from: '2026-11-01' });

    expect(findPage).toHaveBeenCalledWith({ type: 'ingreso', from: '2026-11-01' }, '9', 20);
    expect(record).not.toHaveBeenCalled();
  });

  it('uses a null cursor for the first page', async () => {
    const { service, findPage } = setup();
    findPage.mockResolvedValue({ items: [], nextCursor: null });

    await service.list({ limit: 5 });

    expect(findPage).toHaveBeenCalledWith({}, null, 5);
  });
});

describe('AuditLogQueryService.findById (R9, R16)', () => {
  it('throws 404 when the entry does not exist', async () => {
    const { service, findById, record } = setup();
    findById.mockResolvedValue(null);

    await expect(service.findById('7')).rejects.toBeInstanceOf(NotFoundException);
    expect(record).not.toHaveBeenCalled();
  });
});

describe('AuditLogQueryService.export', () => {
  it('records the filters and the row count, never the content (R14)', async () => {
    const { service, findForExport, record } = setup();
    findForExport.mockResolvedValue([row('2'), row('1')]);

    const result = await service.export(
      user,
      { type: 'ingreso', to: '2026-11-14' },
      new Date('2026-11-14T15:00:00Z'),
    );

    expect(findForExport).toHaveBeenCalledWith({ type: 'ingreso', to: '2026-11-14' }, 3);
    expect(record).toHaveBeenCalledWith({
      userId: 'u-1',
      role: UserRole.Coordinator,
      type: 'coordinacion',
      action: 'Exportó la bitácora',
      entity: 'bitacora',
      entityId: null,
      dataAfter: { filters: { type: 'ingreso', to: '2026-11-14' }, rows: 2 },
    });
    expect(result.fileName).toBe('bitacora-2026-11-14.csv');
    expect(result.content).toContain('Intento fallido');
  });

  it('rejects with 422 above the limit and does not record (R13)', async () => {
    const { service, findForExport, record } = setup(2);
    findForExport.mockResolvedValue([row('3'), row('2'), row('1')]);

    const error = await service.export(user, {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiCodedException);
    expect(error).toMatchObject({ code: 'exportacion_excede_limite' });
    expect((error as ApiCodedException).getStatus()).toBe(422);
    expect(record).not.toHaveBeenCalled();
  });

  it('exports exactly the limit (R13)', async () => {
    const { service, findForExport } = setup(2);
    findForExport.mockResolvedValue([row('2'), row('1')]);

    await expect(service.export(user, {})).resolves.toBeDefined();
  });

  it('does not deliver the CSV when the audit row fails (R15)', async () => {
    const { service, findForExport, record } = setup();
    findForExport.mockResolvedValue([row('1')]);
    record.mockRejectedValue(new Error('db down'));

    await expect(service.export(user, {})).rejects.toThrow('db down');
  });
});
