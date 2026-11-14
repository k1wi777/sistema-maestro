import 'reflect-metadata';
import { CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { validateEnv } from '../core/config/env.validation';
import { createS3Client, httpStatusOf } from '../shared/storage/s3-object-storage';
import { storageSettingsFrom } from '../shared/storage/storage-settings';

/** Crea el bucket configurado si no existe (idempotente). Se ejecuta con `storage:init`. */
async function main(): Promise<void> {
  const settings = storageSettingsFrom(validateEnv(process.env));
  const client = createS3Client(settings);
  try {
    await client.send(new HeadBucketCommand({ Bucket: settings.bucket }));
    process.stdout.write(`El bucket «${settings.bucket}» ya existe.\n`);
    return;
  } catch (error) {
    if (httpStatusOf(error) !== 404) {
      throw error;
    }
  }
  await client.send(new CreateBucketCommand({ Bucket: settings.bucket }));
  process.stdout.write(`Bucket «${settings.bucket}» creado.\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`No se pudo preparar el almacenamiento: ${describe(error)}\n`);
  process.exitCode = 1;
});

/** Sin trazas: el mensaje del SDK no incluye credenciales. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
