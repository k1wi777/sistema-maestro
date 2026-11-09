import { randomBytes } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  PASSWORD_CREDENTIAL_REPOSITORY,
  type PasswordCredentialRepository,
} from './password-credential.repository';
import { PasswordHasher } from './password-hasher';

/** Contraseñas de los usuarios: asignarlas y verificarlas. Nunca expone el hash. */
@Injectable()
export class CredentialsService implements OnModuleInit {
  private readonly hasher = new PasswordHasher();
  private dummyHash = '';

  constructor(
    @Inject(PASSWORD_CREDENTIAL_REPOSITORY)
    private readonly repository: PasswordCredentialRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    // Hash ficticio para igualar el tiempo de respuesta cuando el usuario no existe o no
    // tiene credencial (anti-enumeración).
    this.dummyHash = await this.hasher.hash(randomBytes(24).toString('base64'));
  }

  /** Crea o reemplaza la contraseña del usuario. */
  async assign(userId: string, password: string): Promise<void> {
    await this.repository.save(userId, await this.hasher.hash(password));
  }

  /** Asigna la contraseña solo si el usuario aún no tiene credencial. */
  async assignIfAbsent(userId: string, password: string): Promise<boolean> {
    return this.repository.saveIfAbsent(userId, await this.hasher.hash(password));
  }

  async hasCredential(userId: string): Promise<boolean> {
    return (await this.repository.findByUserId(userId)) !== null;
  }

  /** `false` si la contraseña no coincide o el usuario no tiene credencial. */
  async verify(userId: string, password: string): Promise<boolean> {
    const credential = await this.repository.findByUserId(userId);
    if (!credential) {
      return this.verifyDummy(password);
    }
    return this.hasher.verify(password, credential.hash);
  }

  /** Gasta el mismo tiempo que una verificación real y devuelve siempre `false`. */
  async verifyDummy(password: string): Promise<false> {
    await this.hasher.verify(password, this.dummyHash);
    return false;
  }
}
