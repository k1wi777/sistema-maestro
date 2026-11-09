import type { DataConsent } from '@gns/shared';

export interface NewConsent {
  userId: string;
  policyVersion: string;
  acceptedAt: Date;
  items: string[];
}

/** Aceptación con su dueño: la bitácora necesita saber de quién es. */
export interface ConsentRecord extends DataConsent {
  userId: string;
}

export interface ConsentRepository {
  findById(id: string): Promise<ConsentRecord | null>;
  /** Aceptación de una versión por un usuario (clave única); `null` si no la hay. */
  find(userId: string, policyVersion: string): Promise<ConsentRecord | null>;
  create(input: NewConsent): Promise<ConsentRecord>;
}

export const CONSENT_REPOSITORY = Symbol('CONSENT_REPOSITORY');
