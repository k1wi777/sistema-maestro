import { createServer, type Socket } from 'node:net';
import { S3ObjectStorage } from './s3-object-storage';
import type { StorageSettings } from './object-storage';
import { StorageUnavailableError } from './storage-unavailable.error';

const SETTINGS: StorageSettings = {
  endpoint: 'http://localhost:9000',
  region: 'auto',
  bucket: 'gns-files',
  accessKeyId: 'clave-de-prueba',
  secretAccessKey: 'secreto-de-prueba',
  forcePathStyle: true,
  signedUrlTtlSeconds: 300,
  viewUrlTtlSeconds: 7200,
};

describe('S3ObjectStorage (local signing)', () => {
  const storage = new S3ObjectStorage(SETTINGS);

  it('signs a PUT with the content type and length as signed headers', async () => {
    const before = Date.now();
    const upload = await storage.presignPut('formacion/modulos/m/a', 'video/mp4', 1234);
    const url = new URL(upload.url);

    expect(upload.method).toBe('PUT');
    expect(upload.headers).toEqual({ 'Content-Type': 'video/mp4' });
    expect(url.pathname).toBe('/gns-files/formacion/modulos/m/a');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    const signed = url.searchParams.get('X-Amz-SignedHeaders') ?? '';
    expect(signed).toContain('content-type');
    expect(signed).toContain('content-length');
    expect(upload.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 300_000);
    expect(upload.url).not.toContain('secreto-de-prueba');
  });

  it('uses the view TTL for inline reads and the short one for attachments', async () => {
    const inline = await storage.presignGet('k', {
      fileName: 'video.mp4',
      disposition: 'inline',
      contentType: 'video/mp4',
    });
    const attachment = await storage.presignGet('k', {
      fileName: 'presentación.pptx',
      disposition: 'attachment',
      contentType: 'application/octet-stream',
    });

    expect(new URL(inline.url).searchParams.get('X-Amz-Expires')).toBe('7200');
    expect(new URL(attachment.url).searchParams.get('X-Amz-Expires')).toBe('300');
    expect(new URL(inline.url).searchParams.get('response-content-disposition')).toBe(
      'inline; filename="video.mp4"',
    );
    expect(new URL(attachment.url).searchParams.get('response-content-disposition')).toBe(
      'attachment; filename="presentacion.pptx"',
    );
    expect(inline.expiresAt.getTime()).toBeGreaterThan(attachment.expiresAt.getTime());
  });

  it('translates a network failure into StorageUnavailableError', async () => {
    const unreachable = new S3ObjectStorage({ ...SETTINGS, endpoint: 'http://127.0.0.1:1' });

    await expect(unreachable.head('k')).rejects.toBeInstanceOf(StorageUnavailableError);
  });

  it('gives up on a server that accepts the connection and never answers (R10)', async () => {
    const sockets: Socket[] = [];
    const silent = createServer((socket) => sockets.push(socket));
    await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));
    const { port } = silent.address() as { port: number };
    const mute = new S3ObjectStorage({ ...SETTINGS, endpoint: `http://127.0.0.1:${port}` });
    const started = Date.now();
    try {
      await expect(mute.head('k')).rejects.toBeInstanceOf(StorageUnavailableError);
      await expect(mute.put('k', Buffer.from('x'), 'text/plain')).rejects.toBeInstanceOf(
        StorageUnavailableError,
      );
      // Dos llamadas, cada una con sus reintentos: por debajo de ~12 s en total.
      expect(Date.now() - started).toBeLessThan(12000);
    } finally {
      sockets.forEach((socket) => socket.destroy());
      await new Promise((resolve) => silent.close(resolve));
    }
  }, 20000);
});
