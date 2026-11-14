import type {
  ObjectStorage,
  SignedDownloadOptions,
  SignedUpload,
  SignedUrl,
  StoredObjectInfo,
} from './object-storage';
import { StorageUnavailableError } from './storage-unavailable.error';

/** Doble en memoria para las pruebas unitarias de los servicios; no se registra en ningún módulo. */
export class InMemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, StoredObjectInfo & { body?: Buffer }>();
  readonly removed: string[] = [];
  unavailable = false;

  presignPut(key: string, contentType: string): Promise<SignedUpload> {
    this.guard();
    return Promise.resolve({
      url: `memory://put/${key}`,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      expiresAt: new Date(Date.now() + 300_000),
    });
  }

  presignGet(key: string, options: SignedDownloadOptions): Promise<SignedUrl> {
    this.guard();
    const ttl = options.disposition === 'inline' ? 7_200_000 : 300_000;
    return Promise.resolve({
      url: `memory://get/${options.disposition}/${key}`,
      expiresAt: new Date(Date.now() + ttl),
    });
  }

  head(key: string): Promise<StoredObjectInfo | null> {
    this.guard();
    const found = this.objects.get(key);
    return Promise.resolve(found ? { size: found.size, contentType: found.contentType } : null);
  }

  put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.guard();
    this.objects.set(key, { size: body.length, contentType, body });
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.guard();
    this.objects.delete(key);
    this.removed.push(key);
    return Promise.resolve();
  }

  /** Simula la subida del navegador a la URL firmada. */
  simulateUpload(key: string, contentType: string, size: number): void {
    this.objects.set(key, { size, contentType });
  }

  private guard(): void {
    if (this.unavailable) {
      throw new StorageUnavailableError();
    }
  }
}
