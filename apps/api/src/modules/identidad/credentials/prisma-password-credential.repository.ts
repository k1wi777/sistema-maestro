import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import type {
  PasswordCredential,
  PasswordCredentialRepository,
} from './password-credential.repository';

@Injectable()
export class PrismaPasswordCredentialRepository implements PasswordCredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<PasswordCredential | null> {
    const row = await this.prisma.db.passwordCredential.findUnique({ where: { userId } });
    return row ? { userId: row.userId, hash: row.hash } : null;
  }

  async save(userId: string, hash: string): Promise<void> {
    await this.prisma.db.passwordCredential.upsert({
      where: { userId },
      create: { userId, hash },
      update: { hash },
    });
  }

  async saveIfAbsent(userId: string, hash: string): Promise<boolean> {
    const result = await this.prisma.db.passwordCredential.createMany({
      data: [{ userId, hash }],
      skipDuplicates: true,
    });
    return result.count === 1;
  }
}
