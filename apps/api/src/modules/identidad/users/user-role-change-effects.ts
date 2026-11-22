import { Injectable } from '@nestjs/common';
import type { UserRole } from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';

/** Un cambio de rol ya aplicado, con quién lo hizo (para dejar constancia en la bitácora). */
export interface UserRoleChange {
  userId: string;
  from: UserRole;
  to: UserRole;
  actor: RequestUser;
}

/** Consecuencia de un cambio de rol que vive en otro módulo (asignaciones, grados). */
export interface UserRoleChangeEffect {
  /** Se ejecuta dentro de la transacción del cambio: si falla, el rol no cambia. */
  onRoleChange(change: UserRoleChange): Promise<void>;
}

/**
 * Registro de efectos de un cambio de rol. `estructura` ya depende de `identidad`, así que
 * `identidad` no puede importarla: cada módulo interesado registra su efecto al iniciar y
 * `UsersService` los ejecuta en la misma transacción, sin ciclos de módulos ni eventos asíncronos.
 */
@Injectable()
export class UserRoleChangeEffects {
  private readonly effects: UserRoleChangeEffect[] = [];

  register(effect: UserRoleChangeEffect): void {
    this.effects.push(effect);
  }

  async run(change: UserRoleChange): Promise<void> {
    for (const effect of this.effects) {
      await effect.onRoleChange(change);
    }
  }
}
