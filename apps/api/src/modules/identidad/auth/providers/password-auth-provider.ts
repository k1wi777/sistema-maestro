import { Injectable } from '@nestjs/common';
import { emailSchema, SessionProvider } from '@gns/shared';
import { z } from 'zod';
import { CredentialsService } from '../../credentials/credentials.service';
import { UsersService } from '../../users/users.service';
import type { AuthAttempt, AuthProvider } from './auth-provider';

const passwordInputSchema = z.object({ email: emailSchema, password: z.string() });

/** Correo y contraseña. Es el único que conoce contraseñas. */
@Injectable()
export class PasswordAuthProvider implements AuthProvider {
  readonly name = SessionProvider.Password;

  constructor(
    private readonly users: UsersService,
    private readonly credentials: CredentialsService,
  ) {}

  async authenticate(input: unknown): Promise<AuthAttempt> {
    const parsed = passwordInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, reason: 'unknown_account', userId: null };
    }
    const user = await this.users.findByEmail(parsed.data.email);
    if (!user) {
      // Mismo gasto de tiempo que con un usuario real (anti-enumeración).
      await this.credentials.verifyDummy(parsed.data.password);
      return { ok: false, reason: 'unknown_account', userId: null };
    }
    const valid = await this.credentials.verify(user.id, parsed.data.password);
    return valid
      ? { ok: true, userId: user.id }
      : { ok: false, reason: 'wrong_password', userId: user.id };
  }
}
