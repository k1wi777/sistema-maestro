import { z } from 'zod';

export interface AdminConfig {
  name: string;
  email: string;
}

const adminConfigSchema = z.object({
  SEED_ADMIN_NAME: z
    .string({ error: 'falta o no es texto' })
    .trim()
    .min(1, 'no puede estar vacía')
    .max(120, 'no puede superar 120 caracteres'),
  SEED_ADMIN_EMAIL: z
    .string({ error: 'falta o no es texto' })
    .trim()
    // Minúsculas: el `@unique` de `usuario.correo_institucional` basta para evitar duplicados.
    .toLowerCase()
    .max(160, 'no puede superar 160 caracteres')
    .pipe(z.email('no es un correo válido')),
});

/**
 * Lee el primer administrador del entorno. El error nombra cada variable
 * inválida y el motivo, nunca su valor.
 */
export function parseAdminConfig(env: Readonly<Record<string, string | undefined>>): AdminConfig {
  const parsed = adminConfigSchema.safeParse({
    SEED_ADMIN_NAME: env.SEED_ADMIN_NAME,
    SEED_ADMIN_EMAIL: env.SEED_ADMIN_EMAIL,
  });
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `${String(issue.path[0])}: ${issue.message}`,
    );
    throw new Error(`Configuración del primer administrador inválida. ${problems.join('; ')}.`);
  }
  return { name: parsed.data.SEED_ADMIN_NAME, email: parsed.data.SEED_ADMIN_EMAIL };
}
