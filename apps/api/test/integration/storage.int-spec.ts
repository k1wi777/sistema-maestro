import { randomBytes, randomUUID } from 'node:crypto';
import { validateEnv } from '../../src/core/config/env.validation';
import { S3ObjectStorage } from '../../src/shared/storage/s3-object-storage';
import { storageSettingsFrom } from '../../src/shared/storage/storage-settings';

/** Compatibilidad S3 real: firma, encabezados firmados, descarga y rangos contra MinIO. */
describe('almacenamiento S3 (MinIO real)', () => {
  const storage = new S3ObjectStorage(storageSettingsFrom(validateEnv(process.env)));
  const key = () => `pruebas/${randomUUID()}`;

  it('sube con la URL firmada, la HEAD coincide y la descarga devuelve los mismos bytes', async () => {
    const body = randomBytes(2048);
    const objectKey = key();
    const upload = await storage.presignPut(objectKey, 'video/mp4', body.length);

    const put = await fetch(upload.url, { method: upload.method, headers: upload.headers, body });
    expect(put.status).toBe(200);

    expect(await storage.head(objectKey)).toEqual({ size: 2048, contentType: 'video/mp4' });

    const download = await storage.presignGet(objectKey, {
      fileName: 'Presentación.mp4',
      disposition: 'attachment',
      contentType: 'video/mp4',
    });
    const response = await fetch(download.url);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="Presentacion.mp4"',
    );
    expect(Buffer.from(await response.arrayBuffer()).equals(body)).toBe(true);
  });

  it('rechaza una subida con otro tipo de contenido o con otro tamaño', async () => {
    const objectKey = key();
    const upload = await storage.presignPut(objectKey, 'video/mp4', 100);

    const wrongType = await fetch(upload.url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: randomBytes(100),
    });
    const wrongSize = await fetch(upload.url, {
      method: 'PUT',
      headers: upload.headers,
      body: randomBytes(101),
    });

    expect(wrongType.status).toBeGreaterThanOrEqual(400);
    expect(wrongSize.status).toBeGreaterThanOrEqual(400);
    expect(await storage.head(objectKey)).toBeNull();
  });

  it('atiende peticiones por rangos (206) sobre la URL de visualización', async () => {
    const objectKey = key();
    await storage.put(objectKey, randomBytes(1000), 'video/webm');

    const view = await storage.presignGet(objectKey, {
      fileName: 'video.webm',
      disposition: 'inline',
      contentType: 'video/webm',
    });
    const partial = await fetch(view.url, { headers: { Range: 'bytes=0-99' } });

    expect(partial.status).toBe(206);
    expect((await partial.arrayBuffer()).byteLength).toBe(100);
    expect(partial.headers.get('content-disposition')).toBe('inline; filename="video.webm"');
  });

  it('devuelve null para un objeto inexistente y permite quitar uno rechazado', async () => {
    const objectKey = key();
    expect(await storage.head(objectKey)).toBeNull();

    await storage.put(objectKey, Buffer.from('x'), 'image/png');
    await storage.remove(objectKey);
    expect(await storage.head(objectKey)).toBeNull();
  });
});
