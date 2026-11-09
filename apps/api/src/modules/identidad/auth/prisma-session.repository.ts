import { Injectable } from '@nestjs/common';
import {
  SessionRevocationReason,
  type SessionProvider,
  type UserRole,
  type UserStatus,
} from '@gns/shared';
import type { Session } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import type {
  NewSession,
  SessionRecord,
  SessionRepository,
  SessionWithOwner,
  StaleSessionCriteria,
} from './session.repository';

function toRecord(row: Session): SessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider as SessionProvider,
    generation: row.generation,
    rotatedAt: row.rotatedAt,
    renewedAt: row.renewedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}

@Injectable()
export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: NewSession): Promise<SessionRecord> {
    const row = await this.prisma.db.session.create({
      data: {
        userId: input.userId,
        provider: input.provider,
        renewedAt: input.now,
        expiresAt: input.expiresAt,
      },
    });
    return toRecord(row);
  }

  async findWithOwner(id: string): Promise<SessionWithOwner | null> {
    const row = await this.prisma.db.session.findUnique({
      where: { id },
      include: { user: { select: { id: true, role: true, status: true } } },
    });
    if (!row) {
      return null;
    }
    return {
      session: toRecord(row),
      user: {
        id: row.user.id,
        role: row.user.role as UserRole,
        status: row.user.status as UserStatus,
      },
    };
  }

  async rotate(id: string, expectedGeneration: number, now: Date): Promise<boolean> {
    // La condición sobre la generación hace de bloqueo optimista: si otra petición rotó
    // primero, esta no actualiza ninguna fila.
    const result = await this.prisma.db.session.updateMany({
      where: { id, generation: expectedGeneration, revokedAt: null },
      data: { generation: expectedGeneration + 1, rotatedAt: now, renewedAt: now },
    });
    return result.count === 1;
  }

  async revoke(ids: string[], reason: SessionRevocationReason, now: Date): Promise<void> {
    await this.prisma.db.session.updateMany({
      where: { id: { in: ids }, revokedAt: null },
      data: { revokedAt: now, revocationReason: reason },
    });
  }

  async revokeAllForUser(
    userId: string,
    reason: SessionRevocationReason,
    now: Date,
    exceptId?: string,
  ): Promise<void> {
    await this.prisma.db.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { revokedAt: now, revocationReason: reason },
    });
  }

  async deleteStale(userId: string, criteria: StaleSessionCriteria): Promise<void> {
    await this.prisma.db.session.deleteMany({
      where: {
        userId,
        AND: [
          {
            OR: [
              { revokedAt: { not: null } },
              { expiresAt: { lt: criteria.now } },
              { renewedAt: { lt: criteria.idleCutoff } },
            ],
          },
          // `not` de SQL descarta los nulos: se incluyen de forma explícita.
          {
            OR: [
              { revocationReason: null },
              { revocationReason: { not: SessionRevocationReason.TokenReuse } },
            ],
          },
        ],
      },
    });
  }
}
