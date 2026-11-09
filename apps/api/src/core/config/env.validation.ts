import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
});

export type Env = z.infer<typeof envSchema>;

type EnvKey = keyof Env;

const INVALID_VALUE_REASONS: Record<EnvKey, string> = {
  NODE_ENV: 'debe ser development, test o production',
  PORT: 'debe ser un entero entre 1 y 65535',
};

const MISSING_REASON = 'falta la variable';

function isEnvKey(key: unknown): key is EnvKey {
  return typeof key === 'string' && key in INVALID_VALUE_REASONS;
}

/**
 * Valida las variables de entorno al arrancar la API.
 * El mensaje nombra cada variable y el motivo, pero nunca su valor,
 * para no filtrar secretos en los logs.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (result.success) {
    return result.data;
  }

  const failedKeys = new Set<EnvKey>();
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (isEnvKey(key)) {
      failedKeys.add(key);
    }
  }

  const lines = [...failedKeys].map((key) => {
    const raw = config[key];
    const missing = raw === undefined || raw === '';
    return `- ${key}: ${missing ? MISSING_REASON : INVALID_VALUE_REASONS[key]}`;
  });

  throw new Error(`Configuración de entorno inválida:\n${lines.join('\n')}`);
}
