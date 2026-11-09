import { AuditLogType } from '@gns/shared';
import type { AuditLogRepository, NewAuditLogEntry } from './audit-log.repository';
import { AuditLogService } from './audit-log.service';

function setup() {
  const inserted: NewAuditLogEntry[] = [];
  const repository: AuditLogRepository = {
    insert: (entry) => {
      inserted.push(entry);
      return Promise.resolve();
    },
  };
  return { service: new AuditLogService(repository), inserted };
}

describe('AuditLogService.record', () => {
  it('records an unknown role and no user when there is no session', async () => {
    const { service, inserted } = setup();
    await service.record({ type: AuditLogType.Login, action: 'Intento de ingreso fallido' });
    expect(inserted[0]).toMatchObject({
      userId: null,
      role: 'desconocido',
      entity: null,
      dataBefore: null,
      dataAfter: null,
    });
  });

  it('cuts the action to the column length', async () => {
    const { service, inserted } = setup();
    await service.record({ type: AuditLogType.Login, action: 'a'.repeat(300) });
    expect(inserted[0]?.action).toHaveLength(160);
  });
});
