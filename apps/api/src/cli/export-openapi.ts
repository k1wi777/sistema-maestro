import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { buildOpenApiDocument } from '../core/openapi/openapi';

/** Copia versionada del contrato que compila el frontend (ruta relativa a apps/api). */
const DEFAULT_OUTPUT = '../web/src/shared/api/openapi.json';

/**
 * Escribe el documento OpenAPI sin levantar el servidor: no llama a `init()` ni a `listen()`,
 * así que no conecta con la base de datos (`PrismaService` conecta en `onModuleInit`).
 * Se omite `configureApp`: el documento no depende de los middleware.
 */
async function main(): Promise<void> {
  const output = resolve(process.argv[2] ?? DEFAULT_OUTPUT);
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  try {
    const document = buildOpenApiDocument(app);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
    process.stdout.write(`Contrato OpenAPI escrito en ${output}\n`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`No se pudo exportar el contrato OpenAPI: ${message}\n`);
  process.exitCode = 1;
});
