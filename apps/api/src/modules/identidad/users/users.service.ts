import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  SessionRevocationReason,
  UserStatus,
  type CreateUserInput,
  type ListQuery,
  type Page,
  type UpdateUserInput,
  type User,
} from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../shared/database/transaction-runner';
import { SessionsService } from '../auth/sessions.service';
import { CredentialsService } from '../credentials/credentials.service';
import {
  USER_REPOSITORY,
  type UserFilters,
  type UserRepository,
  type UserSortField,
} from './user.repository';

const EMAIL_TAKEN_MESSAGE = 'Ya existe un usuario con ese correo institucional';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repository: UserRepository,
    @Inject(TRANSACTION_RUNNER) private readonly transactions: TransactionRunner,
    private readonly credentials: CredentialsService,
    private readonly sessions: SessionsService,
  ) {}

  list(query: ListQuery<UserFilters, UserSortField>): Promise<Page<User>> {
    return this.repository.findPage(query);
  }

  find(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }

  /** El correo debe venir normalizado (minúsculas), como lo entregan los esquemas. */
  findByEmail(email: string): Promise<User | null> {
    return this.repository.findByEmail(email);
  }

  async get(id: string): Promise<User> {
    const user = await this.find(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  /** Crea el usuario `activo` y su contraseña inicial en la misma transacción. */
  async create(input: CreateUserInput, actor: RequestUser): Promise<User> {
    if (await this.repository.findByEmail(input.email)) {
      throw new ConflictException(EMAIL_TAKEN_MESSAGE);
    }
    return this.transactions.run(async () => {
      const user = await this.repository.create({
        fullName: input.fullName,
        email: input.email,
        role: input.role,
        createdById: actor.id,
      });
      await this.credentials.assign(user.id, input.password);
      return user;
    });
  }

  async update(id: string, input: UpdateUserInput, actor: RequestUser): Promise<User> {
    const current = await this.get(id);
    if (id === actor.id && input.role !== undefined && input.role !== current.role) {
      throw new ConflictException('No puedes cambiar tu propio rol');
    }
    if (input.email !== undefined && input.email !== current.email) {
      const owner = await this.repository.findByEmail(input.email);
      if (owner && owner.id !== id) {
        throw new ConflictException(EMAIL_TAKEN_MESSAGE);
      }
    }
    return this.repository.update(id, input);
  }

  /** Al desactivar, revoca todas las sesiones del usuario. */
  async setStatus(id: string, status: UserStatus, actor: RequestUser): Promise<User> {
    const current = await this.get(id);
    if (id === actor.id && status === UserStatus.Inactive) {
      throw new ConflictException('No puedes desactivarte a ti mismo');
    }
    return this.transactions.run(async () => {
      const user =
        current.status === status ? current : await this.repository.update(id, { status });
      if (status === UserStatus.Inactive) {
        await this.sessions.revokeAllForUser(id, SessionRevocationReason.Deactivation);
      }
      return user;
    });
  }

  /** Reemplaza la contraseña y revoca todas las sesiones del usuario. */
  async resetPassword(id: string, password: string): Promise<void> {
    await this.get(id);
    await this.transactions.run(async () => {
      await this.credentials.assign(id, password);
      await this.sessions.revokeAllForUser(id, SessionRevocationReason.PasswordChange);
    });
  }
}
