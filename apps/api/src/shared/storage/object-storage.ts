/** Token de inyección del puerto de almacenamiento. */
export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

/** `inline` para que el navegador muestre el archivo (video, PDF, imágenes); `attachment` para descargarlo. */
export type ContentDisposition = 'inline' | 'attachment';

export interface SignedUrl {
  url: string;
  expiresAt: Date;
}

export interface SignedUpload extends SignedUrl {
  method: 'PUT';
  /** Encabezados que la subida debe enviar tal cual: están firmados. */
  headers: Record<string, string>;
}

export interface SignedDownloadOptions {
  /** Nombre que verá el usuario; se sanea (el original queda en la base de datos). */
  fileName: string;
  disposition: ContentDisposition;
  contentType: string;
}

export interface StoredObjectInfo {
  size: number;
  contentType: string;
}

/** Ajustes del almacenamiento S3 (MinIO o Cloudflare R2), tomados de las variables `STORAGE_*`. */
export interface StorageSettings {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  /** Subidas y descargas (`attachment`). */
  signedUrlTtlSeconds: number;
  /** Visualización (`inline`): el reproductor pide rangos contra la misma URL. */
  viewUrlTtlSeconds: number;
}

/**
 * Puerto de almacenamiento de objetos. No sabe nada del dominio: las claves las genera la API y
 * el navegador solo recibe URL firmadas con caducidad. La caducidad la decide la implementación
 * según el modo (`inline` o `attachment`), no quien llama.
 */
export interface ObjectStorage {
  presignPut(key: string, contentType: string, size: number): Promise<SignedUpload>;
  presignGet(key: string, options: SignedDownloadOptions): Promise<SignedUrl>;
  /** Tamaño y tipo del objeto, o `null` si no existe. */
  head(key: string): Promise<StoredObjectInfo | null>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
}
