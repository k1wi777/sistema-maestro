import { Injectable } from '@nestjs/common';
import {
  fromStoredChanges,
  toStoredChanges,
  type Review,
  type ReviewAction,
  type ReviewRecordType,
} from '@gns/shared';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { NewReview, ReviewRepository } from './review.repository';

@Injectable()
export class PrismaReviewRepository implements ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(review: NewReview): Promise<void> {
    await this.prisma.db.review.create({
      data: {
        recordType: review.recordType,
        recordId: review.recordId,
        reviewerId: review.reviewerId,
        action: review.action,
        comment: review.comment,
        adjustedFields: review.adjustedFields,
        changes: review.changes
          ? (toStoredChanges(review.changes) as Prisma.InputJsonObject)
          : undefined,
        date: review.date,
      },
    });
  }

  async findByRecord(recordType: ReviewRecordType, recordId: string): Promise<Review[]> {
    const rows = await this.prisma.db.review.findMany({
      where: { recordType, recordId },
      include: { reviewer: { select: { id: true, fullName: true } } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      action: row.action as ReviewAction,
      comment: row.comment,
      reviewer: { id: row.reviewer.id, fullName: row.reviewer.fullName },
      date: row.date,
      adjustedFields: row.adjustedFields,
      changes: fromStoredChanges(row.changes),
    }));
  }
}
