import type { Env } from '../../core/config/env.validation';
import type { StorageSettings } from './object-storage';

export const STORAGE_ENV_KEYS = [
  'STORAGE_ENDPOINT',
  'STORAGE_REGION',
  'STORAGE_BUCKET',
  'STORAGE_ACCESS_KEY_ID',
  'STORAGE_SECRET_ACCESS_KEY',
  'STORAGE_FORCE_PATH_STYLE',
  'STORAGE_SIGNED_URL_TTL_SECONDS',
  'STORAGE_VIEW_URL_TTL_SECONDS',
] as const;

export type StorageEnv = Pick<Env, (typeof STORAGE_ENV_KEYS)[number]>;

/** Ajustes de almacenamiento a partir de la configuración ya validada. */
export function storageSettingsFrom(env: StorageEnv): StorageSettings {
  return {
    endpoint: env.STORAGE_ENDPOINT,
    region: env.STORAGE_REGION,
    bucket: env.STORAGE_BUCKET,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
    signedUrlTtlSeconds: env.STORAGE_SIGNED_URL_TTL_SECONDS,
    viewUrlTtlSeconds: env.STORAGE_VIEW_URL_TTL_SECONDS,
  };
}
