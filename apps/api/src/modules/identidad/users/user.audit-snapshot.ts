import { Injectable } from '@nestjs/common';
import type { AuditSnapshotSource } from '../../../core/audit/audit-snapshot';
import { UsersService } from './users.service';

/**
 * Estado del usuario para la bitácora. Delega en la lectura del servicio, que nunca
 * incluye la credencial: el hash no puede llegar a la bitácora (R9, R11).
 */
@Injectable()
export class UserAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly users: UsersService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    const user = await this.users.find(id);
    return user ? { ...user } : null;
  }
}
