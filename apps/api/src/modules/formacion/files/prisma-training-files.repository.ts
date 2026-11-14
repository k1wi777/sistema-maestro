import { Injectable } from '@nestjs/common';
import { ModuleFilePurpose, StoredFileStatus, type StoredFilePurpose } from '@gns/shared';
import type { StoredFile as FileRow } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import type {
  NewStoredFile,
  StoredFileRecord,
  TrainingFilesRepository,
} from './training-files.repository';

const toRecord = (row: FileRow): StoredFileRecord => ({
  id: row.id,
  objectKey: row.objectKey,
  purpose: row.purpose as StoredFilePurpose,
  contentType: row.contentType,
  size: Number(row.sizeBytes),
  originalName: row.originalName,
  status: row.status as StoredFileStatus,
});

@Injectable()
export class PrismaTrainingFilesRepository implements TrainingFilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPending(file: NewStoredFile): Promise<StoredFileRecord> {
    const row = await this.prisma.db.storedFile.create({
      data: {
        id: file.id,
        objectKey: file.objectKey,
        purpose: file.purpose,
        contentType: file.contentType,
        sizeBytes: file.size,
        originalName: file.originalName,
        status: StoredFileStatus.Pending,
        uploadedById: file.uploadedById,
      },
    });
    return toRecord(row);
  }

  async createAvailableIfAbsent(file: NewStoredFile): Promise<void> {
    // `ON CONFLICT DO NOTHING`: dos descargas simultáneas registran la misma clave una sola vez
    // sin abortar la transacción de ninguna.
    await this.prisma.db.storedFile.createMany({
      data: [
        {
          id: file.id,
          objectKey: file.objectKey,
          purpose: file.purpose,
          contentType: file.contentType,
          sizeBytes: file.size,
          originalName: file.originalName,
          status: StoredFileStatus.Available,
          uploadedById: file.uploadedById,
          confirmedAt: new Date(),
        },
      ],
      skipDuplicates: true,
    });
  }

  async findByObjectKey(objectKey: string): Promise<StoredFileRecord | null> {
    const row = await this.prisma.db.storedFile.findUnique({ where: { objectKey } });
    return row ? toRecord(row) : null;
  }

  async findFile(id: string): Promise<StoredFileRecord | null> {
    const row = await this.prisma.db.storedFile.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async findModuleFile(
    moduleId: string,
    purpose: ModuleFilePurpose,
  ): Promise<StoredFileRecord | null> {
    const row = await this.prisma.db.trainingModule.findUnique({
      where: { id: moduleId },
      select: { videoFile: true, presentationFile: true },
    });
    const file = purpose === ModuleFilePurpose.Video ? row?.videoFile : row?.presentationFile;
    return file ? toRecord(file) : null;
  }

  async markAvailable(id: string, confirmedAt: Date): Promise<void> {
    await this.prisma.db.storedFile.update({
      where: { id },
      data: { status: StoredFileStatus.Available, confirmedAt },
    });
  }

  async markRejected(id: string): Promise<void> {
    // Cliente sin transacción a propósito (ver la interfaz).
    await this.prisma.storedFile.update({
      where: { id },
      data: { status: StoredFileStatus.Rejected },
    });
  }

  async attach(moduleId: string, purpose: ModuleFilePurpose, fileId: string): Promise<void> {
    await this.prisma.db.trainingModule.update({
      where: { id: moduleId },
      data:
        purpose === ModuleFilePurpose.Video
          ? { videoFileId: fileId, videoUrl: null }
          : { presentationFileId: fileId, presentationUrl: null },
    });
  }

  async detach(moduleId: string, purpose: ModuleFilePurpose): Promise<void> {
    await this.prisma.db.trainingModule.update({
      where: { id: moduleId },
      data:
        purpose === ModuleFilePurpose.Video ? { videoFileId: null } : { presentationFileId: null },
    });
  }
}
