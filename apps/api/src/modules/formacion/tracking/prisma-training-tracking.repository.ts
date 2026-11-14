import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { TrackedProgress } from './tracking-summary';
import type {
  TrackedCertificate,
  TrainingTrackingRepository,
} from './training-tracking.repository';

@Injectable()
export class PrismaTrainingTrackingRepository implements TrainingTrackingRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Una sola consulta por tabla, sin N+1: nunca se leen partidas ni intentos. */
  async findProgress(
    moduleIds: readonly string[],
    teacherIds: readonly string[],
  ): Promise<TrackedProgress[]> {
    return this.prisma.db.moduleProgress.findMany({
      where: { moduleId: { in: [...moduleIds] }, teacherId: { in: [...teacherIds] } },
      select: { teacherId: true, moduleId: true, completedAt: true, bestScore: true },
    });
  }

  async findModuleCertificates(
    moduleIds: readonly string[],
    teacherIds: readonly string[],
  ): Promise<TrackedCertificate[]> {
    const rows = await this.prisma.db.certificate.findMany({
      where: { moduleId: { in: [...moduleIds] }, teacherId: { in: [...teacherIds] } },
      select: { teacherId: true, moduleId: true },
    });
    return rows.flatMap((row) =>
      row.moduleId ? [{ teacherId: row.teacherId, moduleId: row.moduleId }] : [],
    );
  }
}
