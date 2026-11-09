import { z } from 'zod';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

// Origen web sin ruta ni barra final: `http(s)://host[:puerto]`.
const ORIGIN_PATTERN = /^https?:\/\/[^\s/?#]+$/;

const corsOrigins = z
  .string()
  .transform((value) => value.split(',').map((origin) => origin.trim()))
  .pipe(z.array(z.string().regex(ORIGIN_PATTERN)).min(1));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  CORS_ORIGINS: corsOrigins,
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3600).default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).max(10000).default(100),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});

export type Env = z.infer<typeof envSchema>;

type EnvKey = keyof Env;

const INVALID_VALUE_REASONS: Record<EnvKey, string> = {
  NODE_ENV: 'debe ser development, test o production',
  PORT: 'debe ser un entero entre 1 y 65535',
  DATABASE_URL: 'debe ser una URL de PostgreSQL (postgresql://usuario:clave@host:puerto/base)',
  CORS_ORIGINS:
    'debe ser una lista separada por comas de orígenes http(s)://host[:puerto], sin ruta ni barra final',
  RATE_LIMIT_WINDOW_SECONDS: 'debe ser un entero entre 1 y 3600',
  RATE_LIMIT_MAX_REQUESTS: 'debe ser un entero entre 1 y 10000',
  LOG_LEVEL: `debe ser ${LOG_LEVELS.join(', ')}`,
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
