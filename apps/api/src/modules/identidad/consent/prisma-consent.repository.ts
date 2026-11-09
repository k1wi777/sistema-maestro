import { Injectable } from '@nestjs/common';
import type { DataConsentItem } from '@gns/shared';
import type { DataConsent as DataConsentRow } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { ConsentRecord, ConsentRepository, NewConsent } from './consent.repository';

function toEntity(row: DataConsentRow): ConsentRecord {
  return {
    id: row.id,
    userId: row.userId,
    policyVersion: row.policyVersion,
    acceptedAt: row.acceptedAt,
    items: row.checkedItems as DataConsentItem[],
  };
}

@Injectable()
export class PrismaConsentRepository implements ConsentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ConsentRecord | null> {
    const row = await this.prisma.db.dataConsent.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async find(userId: string, policyVersion: string): Promise<ConsentRecord | null> {
    const row = await this.prisma.db.dataConsent.findUnique({
      where: { userId_policyVersion: { userId, policyVersion } },
    });
    return row ? toEntity(row) : null;
  }

  async create(input: NewConsent): Promise<ConsentRecord> {
    const row = await this.prisma.db.dataConsent.create({
      data: {
        userId: input.userId,
        policyVersion: input.policyVersion,
        acceptedAt: input.acceptedAt,
        checkedItems: input.items,
      },
    });
    return toEntity(row);
  }
}
