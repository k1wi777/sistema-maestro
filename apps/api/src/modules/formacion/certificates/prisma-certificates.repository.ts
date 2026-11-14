import { Injectable } from '@nestjs/common';
import type { Certificate as CertificateRow } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import type {
  CertificateRecord,
  CertificatesRepository,
  NewCertificate,
} from './certificates.repository';

const toRecord = (row: CertificateRow): CertificateRecord => ({
  id: row.id,
  teacherId: row.teacherId,
  moduleId: row.moduleId,
  code: row.code,
  issuedAt: row.issuedAt,
  fileId: row.fileId,
  teacherName: row.teacherName,
  title: row.title,
  planName: row.planName,
});

@Injectable()
export class PrismaCertificatesRepository implements CertificatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insertIfAbsent(certificate: NewCertificate): Promise<boolean> {
    // `skipDuplicates` es `ON CONFLICT DO NOTHING`: un código repetido o un certificado ya emitido
    // no abortan la transacción, que sigue siendo válida para reintentar con otro código.
    const result = await this.prisma.db.certificate.createMany({
      data: [
        {
          id: certificate.id,
          teacherId: certificate.teacherId,
          moduleId: certificate.moduleId,
          code: certificate.code,
          issuedAt: certificate.issuedAt,
          teacherName: certificate.teacherName,
          title: certificate.title,
          planName: certificate.planName,
        },
      ],
      skipDuplicates: true,
    });
    return result.count === 1;
  }

  async findByTeacherAndModule(
    teacherId: string,
    moduleId: string | null,
  ): Promise<CertificateRecord | null> {
    const row = await this.prisma.db.certificate.findFirst({ where: { teacherId, moduleId } });
    return row ? toRecord(row) : null;
  }

  async findById(id: string): Promise<CertificateRecord | null> {
    const row = await this.prisma.db.certificate.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async listByTeacher(teacherId: string): Promise<CertificateRecord[]> {
    const rows = await this.prisma.db.certificate.findMany({
      where: { teacherId },
      orderBy: [{ issuedAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map(toRecord);
  }

  async findByCode(code: string): Promise<CertificateRecord | null> {
    const row = await this.prisma.db.certificate.findUnique({ where: { code } });
    return row ? toRecord(row) : null;
  }

  async setFileIfAbsent(certificateId: string, fileId: string): Promise<boolean> {
    const result = await this.prisma.db.certificate.updateMany({
      where: { id: certificateId, fileId: null },
      data: { fileId },
    });
    return result.count === 1;
  }
}
