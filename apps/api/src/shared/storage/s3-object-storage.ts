import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { sanitizeFileName } from './file-name';
import type {
  ObjectStorage,
  SignedDownloadOptions,
  SignedUpload,
  SignedUrl,
  StorageSettings,
  StoredObjectInfo,
} from './object-storage';
import { StorageUnavailableError } from './storage-unavailable.error';

/**
 * Tiempos límite del cliente S3 (ms). Sin ellos un almacenamiento que acepta la conexión y no
 * responde dejaría la petición colgada. Peor caso con 2 intentos: unos 4 s antes del 503
 * (2 × 2 s de espera más la pausa entre intentos). Ninguna llamada de red corre dentro de una
 * transacción de base de datos, así que el límite de Prisma (5 s) no interviene.
 */
export const S3_CONNECTION_TIMEOUT_MS = 1500;
export const S3_REQUEST_TIMEOUT_MS = 2000;
export const S3_MAX_ATTEMPTS = 2;

/**
 * Cliente S3 para MinIO (local) y Cloudflare R2. Las sumas de verificación se piden solo cuando
 * el servicio las exige: las versiones recientes del SDK añaden CRC por defecto, que MinIO y R2
 * rechazan o que el navegador no puede reproducir en un PUT firmado.
 */
export function createS3Client(settings: StorageSettings): S3Client {
  return new S3Client({
    endpoint: settings.endpoint,
    region: settings.region,
    forcePathStyle: settings.forcePathStyle,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    maxAttempts: S3_MAX_ATTEMPTS,
    requestHandler: {
      connectionTimeout: S3_CONNECTION_TIMEOUT_MS,
      requestTimeout: S3_REQUEST_TIMEOUT_MS,
      // Sin esto el SDK solo avisa del tiempo agotado y la petición queda colgada.
      throwOnRequestTimeout: true,
    },
  });
}

export function httpStatusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  return (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly settings: StorageSettings) {
    this.client = createS3Client(settings);
  }

  async presignPut(key: string, contentType: string, size: number): Promise<SignedUpload> {
    const expiresIn = this.settings.signedUrlTtlSeconds;
    try {
      const url = await getSignedUrl(
        this.client,
        new PutObjectCommand({
          Bucket: this.settings.bucket,
          Key: key,
          ContentType: contentType,
          ContentLength: size,
        }),
        { expiresIn, signableHeaders: new Set(['content-type', 'content-length']) },
      );
      // `Content-Length` también va firmado, pero el navegador lo calcula del cuerpo y no
      // permite fijarlo: el cliente solo debe enviar el tipo tal cual.
      return {
        url,
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        expiresAt: this.expiry(expiresIn),
      };
    } catch (error) {
      throw new StorageUnavailableError({ cause: error });
    }
  }

  async presignGet(key: string, options: SignedDownloadOptions): Promise<SignedUrl> {
    const expiresIn =
      options.disposition === 'inline'
        ? this.settings.viewUrlTtlSeconds
        : this.settings.signedUrlTtlSeconds;
    try {
      const url = await getSignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: this.settings.bucket,
          Key: key,
          ResponseContentDisposition: `${options.disposition}; filename="${sanitizeFileName(options.fileName)}"`,
          ResponseContentType: options.contentType,
        }),
        { expiresIn },
      );
      return { url, expiresAt: this.expiry(expiresIn) };
    } catch (error) {
      throw new StorageUnavailableError({ cause: error });
    }
  }

  async head(key: string): Promise<StoredObjectInfo | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.settings.bucket, Key: key }),
      );
      return { size: result.ContentLength ?? 0, contentType: result.ContentType ?? '' };
    } catch (error) {
      if (httpStatusOf(error) === 404) {
        return null;
      }
      throw new StorageUnavailableError({ cause: error });
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.settings.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (error) {
      throw new StorageUnavailableError({ cause: error });
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: key }));
    } catch (error) {
      throw new StorageUnavailableError({ cause: error });
    }
  }

  private expiry(seconds: number): Date {
    return new Date(Date.now() + seconds * 1000);
  }
}
