import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATA_CONSENT_ITEMS, type AcceptConsentInput, type ConsentStatus } from '@gns/shared';
import type { Env } from '../../../core/config/env.validation';
import {
  CONSENT_REPOSITORY,
  type ConsentRecord,
  type ConsentRepository,
} from './consent.repository';

@Injectable()
export class ConsentService {
  private readonly currentVersion: string;

  constructor(
    @Inject(CONSENT_REPOSITORY) private readonly repository: ConsentRepository,
    config: ConfigService<Env, true>,
  ) {
    this.currentVersion = config.get('DATA_POLICY_VERSION', { infer: true });
  }

  async status(userId: string): Promise<ConsentStatus> {
    const accepted = await this.repository.find(userId, this.currentVersion);
    return {
      policyVersion: this.currentVersion,
      accepted: accepted !== null,
      acceptedAt: accepted?.acceptedAt ?? null,
    };
  }

  async hasAcceptedCurrent(userId: string): Promise<boolean> {
    return (await this.repository.find(userId, this.currentVersion)) !== null;
  }

  /** Lectura por id para la bitácora. */
  find(id: string): Promise<ConsentRecord | null> {
    return this.repository.findById(id);
  }

  /**
   * Registra la aceptación de la versión vigente con la hora del servidor. Una repetición
   * simultánea choca con la clave única y `mapPrismaError` responde 409.
   */
  async accept(userId: string, input: AcceptConsentInput): Promise<ConsentRecord> {
    if (input.policyVersion !== this.currentVersion) {
      throw new ConflictException('La versión del aviso cambió; vuelve a cargarlo');
    }
    if (await this.hasAcceptedCurrent(userId)) {
      throw new ConflictException('Ya aceptaste esta versión del aviso');
    }
    return this.repository.create({
      userId,
      policyVersion: this.currentVersion,
      acceptedAt: new Date(),
      items: [...DATA_CONSENT_ITEMS],
    });
  }
}
