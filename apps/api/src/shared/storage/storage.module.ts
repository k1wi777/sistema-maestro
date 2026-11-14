import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../core/config/env.validation';
import { OBJECT_STORAGE } from './object-storage';
import { S3ObjectStorage } from './s3-object-storage';
import { STORAGE_ENV_KEYS, type StorageEnv, storageSettingsFrom } from './storage-settings';

/**
 * Provee el puerto con la implementación S3. No comprueba el bucket al arrancar: si el
 * almacenamiento no está disponible, la API arranca y solo las rutas de archivos responden 503.
 */
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const env = Object.fromEntries(
          STORAGE_ENV_KEYS.map((key) => [key, config.get(key, { infer: true })]),
        ) as StorageEnv;
        return new S3ObjectStorage(storageSettingsFrom(env));
      },
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
