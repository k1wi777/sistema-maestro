import { Injectable } from '@nestjs/common';
import type { AuditSnapshotSource } from '../../../src/core/audit/audit-snapshot';

export const FIXED_ID = '3f2b9f3e-5d0f-4a52-9a53-0c8f9f2f7a11';

@Injectable()
export class SecretSnapshot implements AuditSnapshotSource {
  load(id: string): Promise<Record<string, unknown> | null> {
    return Promise.resolve({
      id,
      nombre: 'Sofía',
      passwordHash: 'hash-super-secreto',
      nested: { token: 'token-super-secreto' },
    });
  }
}

@Injectable()
export class BigSnapshot implements AuditSnapshotSource {
  load(id: string): Promise<Record<string, unknown> | null> {
    return Promise.resolve({ id, notas: 'x'.repeat(70 * 1024), otro: 1 });
  }
}
