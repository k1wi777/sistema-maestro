import { z } from 'zod';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

// Origen web sin ruta ni barra final: `http(s)://host[:puerto]`.
const ORIGIN_PATTERN = /^https?:\/\/[^\s/?#]+$/;

const corsOrigins = z
  .string()
  .transform((value) => value.split(',').map((origin) => origin.trim()))
  .pipe(z.array(z.string().regex(ORIGIN_PATTERN)).min(1));

const MIN_SECRET_LENGTH = 32;

// Versión vigente del aviso de datos: cabe en `consentimiento_datos.version_politica` (20).
const POLICY_VERSION_PATTERN = /^[A-Za-z0-9._-]{1,20}$/;

// Nombre de bucket S3: 3 a 63 caracteres, minúsculas, dígitos y guion, sin guion en los extremos.
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

const secret = z.string().min(MIN_SECRET_LENGTH);

// Solo `true` o `false`: `z.coerce.boolean` convertiría "false" en true.
const booleanText = z.enum(['true', 'false']).transform((value) => value === 'true');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().int().min(1).max(65535),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    CORS_ORIGINS: corsOrigins,
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3600).default(60),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).max(10000).default(100),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    JWT_ACCESS_SECRET: secret,
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
    REFRESH_TOKEN_SECRET: secret,
    REFRESH_ROTATION_GRACE_SECONDS: z.coerce.number().int().min(0).max(300).default(30),
    SESSION_IDLE_TIMEOUT_HOURS: z.coerce.number().int().min(1).max(720).default(24),
    SESSION_REMEMBER_MAX_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    AUTH_COOKIE_SECURE: booleanText.default(true),
    LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(5),
    LOGIN_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3600).default(300),
    // Sin valor por defecto: es un dato legal y uno implícito registraría aceptaciones de una versión no publicada.
    DATA_POLICY_VERSION: z.string().regex(POLICY_VERSION_PATTERN),
    // Almacenamiento S3 (MinIO en local, Cloudflare R2 en producción). Sin valores por defecto
    // para el endpoint, el bucket ni las credenciales.
    STORAGE_ENDPOINT: z.url({ protocol: /^https?$/ }),
    STORAGE_REGION: z.string().min(1).max(40).default('auto'),
    STORAGE_BUCKET: z.string().regex(BUCKET_PATTERN),
    STORAGE_ACCESS_KEY_ID: z.string().min(1),
    STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
    STORAGE_FORCE_PATH_STYLE: booleanText.default(true),
    // Subidas (PUT) y descargas (GET `attachment`: PPTX y certificados).
    STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
    // Visualización (GET `inline`): el reproductor pide rangos contra la misma URL mientras reproduce.
    STORAGE_VIEW_URL_TTL_SECONDS: z.coerce.number().int().min(600).max(21600).default(7200),
  })
  .superRefine((env, ctx) => {
    if (env.JWT_ACCESS_SECRET === env.REFRESH_TOKEN_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['REFRESH_TOKEN_SECRET'], message: 'secretos iguales' });
    }
    if (env.SESSION_REMEMBER_MAX_DAYS * 24 <= env.SESSION_IDLE_TIMEOUT_HOURS) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_REMEMBER_MAX_DAYS'],
        message: 'no supera la inactividad',
      });
    }
    if (env.NODE_ENV === 'production' && !env.AUTH_COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_COOKIE_SECURE'],
        message: 'debe ser true en producción',
      });
    }
    if (env.STORAGE_VIEW_URL_TTL_SECONDS < env.STORAGE_SIGNED_URL_TTL_SECONDS) {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_VIEW_URL_TTL_SECONDS'],
        message: 'menor que la de descargas',
      });
    }
    if (env.NODE_ENV === 'production' && !env.STORAGE_ENDPOINT.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_ENDPOINT'],
        message: 'debe ser https en producción',
      });
    }
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
  JWT_ACCESS_SECRET: `debe tener al menos ${MIN_SECRET_LENGTH} caracteres`,
  ACCESS_TOKEN_TTL_MINUTES: 'debe ser un entero entre 1 y 60',
  REFRESH_TOKEN_SECRET: `debe tener al menos ${MIN_SECRET_LENGTH} caracteres y ser distinto de JWT_ACCESS_SECRET`,
  REFRESH_ROTATION_GRACE_SECONDS: 'debe ser un entero entre 0 y 300',
  SESSION_IDLE_TIMEOUT_HOURS: 'debe ser un entero entre 1 y 720',
  SESSION_REMEMBER_MAX_DAYS:
    'debe ser un entero entre 1 y 90 y mayor que la inactividad (SESSION_IDLE_TIMEOUT_HOURS)',
  AUTH_COOKIE_SECURE: 'debe ser true o false (y true en producción)',
  LOGIN_MAX_ATTEMPTS: 'debe ser un entero entre 1 y 100',
  LOGIN_WINDOW_SECONDS: 'debe ser un entero entre 1 y 3600',
  DATA_POLICY_VERSION:
    'debe tener de 1 a 20 caracteres: letras, números, punto, guion o guion bajo',
  STORAGE_ENDPOINT: 'debe ser una URL http(s) del servicio S3 (https en producción)',
  STORAGE_REGION: 'debe tener de 1 a 40 caracteres',
  STORAGE_BUCKET:
    'debe ser un nombre de bucket válido: de 3 a 63 caracteres, minúsculas, números y guion',
  STORAGE_ACCESS_KEY_ID: 'no puede estar vacía',
  STORAGE_SECRET_ACCESS_KEY: 'no puede estar vacía',
  STORAGE_FORCE_PATH_STYLE: 'debe ser true o false',
  STORAGE_SIGNED_URL_TTL_SECONDS: 'debe ser un entero entre 60 y 3600',
  STORAGE_VIEW_URL_TTL_SECONDS:
    'debe ser un entero entre 600 y 21600 y no menor que STORAGE_SIGNED_URL_TTL_SECONDS',
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
