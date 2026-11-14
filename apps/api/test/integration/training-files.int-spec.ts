import { randomBytes } from 'node:crypto';
import { createServer, type Socket } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import {
  PPTX_CONTENT_TYPE,
  StoredFileStatus,
  UserRole,
  type ApiErrorBody,
  type TeacherModule,
  type TeacherRoute,
  type TrainingModule,
} from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { OBJECT_STORAGE, type ObjectStorage } from '../../src/shared/storage/object-storage';
import { createTestApp } from './support/create-test-app';
import { setupPlanning, type Planning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { createTestUser, signIn, type Cookies } from './support/session';
import {
  buildModule,
  call,
  milestonesOf,
  setupCourse,
  trainingAudit,
  type Course,
} from './support/training';

const VIEW_TTL_SECONDS = 7200;
const DOWNLOAD_TTL_SECONDS = 300;
const YOUTUBE = 'https://youtu.be/dQw4w9WgXcQ';

interface UploadResult {
  fileId: string;
  upload: { url: string; method: 'PUT'; headers: Record<string, string>; expiresAt: string };
}
interface UrlResult {
  url: string;
  expiresAt: string;
}

/** Segundos que faltan para `expiresAt`. */
const secondsLeft = (expiresAt: string): number => (Date.parse(expiresAt) - Date.now()) / 1000;

describe('archivos de los módulos de formación (BE-7)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: ObjectStorage;
  let planning: Planning;
  let release: () => Promise<void>;
  let coord: Cookies;

  async function course(options: Parameters<typeof buildModule>[3] = { video: true }) {
    const base = await setupCourse(app, planning, coord);
    const module = await buildModule(app, coord, base.section.id, options);
    return { ...base, moduleId: module.id };
  }

  const request = (moduleId: string, body: Record<string, unknown>) =>
    call(app, coord, 'post', `/training-modules/${moduleId}/files`).send(body);

  /** Solicita, sube con la URL firmada y confirma; devuelve el módulo actualizado. */
  async function attach(
    moduleId: string,
    purpose: 'video' | 'presentacion',
    contentType: string,
    body: Buffer,
    name = 'archivo',
  ) {
    const requested = await request(moduleId, {
      purpose,
      name,
      contentType,
      size: body.length,
    }).expect(201);
    const { fileId, upload } = requested.body as UploadResult;
    const put = await fetch(upload.url, { method: upload.method, headers: upload.headers, body });
    expect(put.status).toBe(200);
    const confirmed = await call(
      app,
      coord,
      'post',
      `/training-modules/${moduleId}/files/${fileId}/confirm`,
    ).expect(200);
    return { fileId, module: confirmed.body as TrainingModule };
  }

  const objectKeyOf = async (fileId: string): Promise<string> =>
    (await prisma.storedFile.findUniqueOrThrow({ where: { id: fileId } })).objectKey;

  const coordUrl = (moduleId: string, purpose: 'video' | 'presentacion') =>
    call(app, coord, 'post', `/training-modules/${moduleId}/files/${purpose}/url`);
  const teacherUrl = (c: Course, moduleId: string, purpose: 'video' | 'presentacion') =>
    call(app, c.teacher, 'post', `/me/training/modules/${moduleId}/files/${purpose}/url`);

  beforeAll(async () => {
    release = await holdSchoolYearLock('shared');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    storage = app.get<ObjectStorage>(OBJECT_STORAGE);
    planning = await setupPlanning(app);
    coord = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await release();
  });

  describe('subida, confirmación y descarga firmadas (R1, R3, R8, R26)', () => {
    it('sube con la URL firmada, confirma y descarga los mismos bytes con la caducidad de visualización', async () => {
      const c = await course();
      const bytes = randomBytes(4096);

      const { fileId, module } = await attach(c.moduleId, 'video', 'video/mp4', bytes, 'Clase.mp4');

      expect(module).toMatchObject({
        videoUrl: null,
        videoSource: 'archivo',
        videoEmbedUrl: null,
        videoFile: { id: fileId, name: 'Clase.mp4', contentType: 'video/mp4', size: 4096 },
      });
      expect(await prisma.storedFile.findUnique({ where: { id: fileId } })).toMatchObject({
        status: StoredFileStatus.Available,
        purpose: 'video_modulo',
        uploadedById: expect.any(String) as string,
      });

      const res = await coordUrl(c.moduleId, 'video').expect(200);
      const { url, expiresAt } = res.body as UrlResult;
      expect(Math.abs(secondsLeft(expiresAt) - VIEW_TTL_SECONDS)).toBeLessThan(30);
      const download = await fetch(url);
      expect(download.status).toBe(200);
      expect(download.headers.get('content-disposition')).toBe('inline; filename="Clase.mp4"');
      expect(Buffer.from(await download.arrayBuffer()).equals(bytes)).toBe(true);
    });

    it('atiende rangos (206) sobre la URL del video para reproducir y buscar', async () => {
      const c = await course();
      await attach(c.moduleId, 'video', 'video/webm', randomBytes(2048));

      const { url } = (await coordUrl(c.moduleId, 'video').expect(200)).body as UrlResult;
      const partial = await fetch(url, { headers: { Range: 'bytes=0-99' } });

      expect(partial.status).toBe(206);
      expect((await partial.arrayBuffer()).byteLength).toBe(100);
      expect(partial.headers.get('content-range')).toBe('bytes 0-99/2048');
    });

    it('entrega un PPTX solo como descarga y con la caducidad corta', async () => {
      const c = await course();
      const bytes = randomBytes(1500);
      await attach(c.moduleId, 'presentacion', PPTX_CONTENT_TYPE, bytes, 'Charla.pptx');

      const { url, expiresAt } = (await coordUrl(c.moduleId, 'presentacion').expect(200))
        .body as UrlResult;
      const download = await fetch(url);

      expect(Math.abs(secondsLeft(expiresAt) - DOWNLOAD_TTL_SECONDS)).toBeLessThan(30);
      expect(download.headers.get('content-disposition')).toBe(
        'attachment; filename="Charla.pptx"',
      );
      expect(Buffer.from(await download.arrayBuffer()).equals(bytes)).toBe(true);
    });

    it('muestra un PDF o una imagen dentro del módulo (inline, caducidad de visualización)', async () => {
      const c = await course();
      await attach(c.moduleId, 'presentacion', 'application/pdf', randomBytes(900), 'Guía.pdf');

      const { url, expiresAt } = (await coordUrl(c.moduleId, 'presentacion').expect(200))
        .body as UrlResult;

      expect(Math.abs(secondsLeft(expiresAt) - VIEW_TTL_SECONDS)).toBeLessThan(30);
      expect((await fetch(url)).headers.get('content-disposition')).toBe(
        'inline; filename="Guia.pdf"',
      );
    });
  });

  describe('validación de la solicitud (R2)', () => {
    it.each([
      ['un tipo de contenido no permitido', { contentType: 'application/zip' }],
      ['un video con el tipo de una imagen', { contentType: 'image/png' }],
      ['un video de más de 500 MB', { size: 500 * 1024 * 1024 + 1 }],
      ['un tamaño cero', { size: 0 }],
      ['un propósito desconocido', { purpose: 'certificado' }],
      ['un campo de más', { extra: 'x' }],
    ])('responde 400 con %s, sin registrar el archivo ni emitir URL', async (_name, change) => {
      const c = await course();
      const name = `rechazado-${Date.now()}`;

      const res = await request(c.moduleId, {
        purpose: 'video',
        name,
        contentType: 'video/mp4',
        size: 1000,
        ...change,
      }).expect(400);

      expect(JSON.stringify(res.body)).not.toMatch(/X-Amz|https?:\/\//);
      expect(await prisma.storedFile.count({ where: { originalName: name } })).toBe(0);
    });

    it('limita la presentación a 50 MB', async () => {
      const c = await course();

      await request(c.moduleId, {
        purpose: 'presentacion',
        name: 'grande.pdf',
        contentType: 'application/pdf',
        size: 50 * 1024 * 1024 + 1,
      }).expect(400);
    });

    it('responde 404 para un módulo que no existe y 400 para un id mal formado', async () => {
      await request('00000000-0000-4000-8000-000000000000', {
        purpose: 'video',
        name: 'a.mp4',
        contentType: 'video/mp4',
        size: 10,
      }).expect(404);
      await call(app, coord, 'post', '/training-modules/no-es-uuid/files').send({}).expect(400);
    });
  });

  describe('confirmación (R3, R4)', () => {
    it('responde 409 y deja el archivo rechazado cuando no se subió nada', async () => {
      const c = await course();
      const requested = (
        await request(c.moduleId, {
          purpose: 'video',
          name: 'fantasma.mp4',
          contentType: 'video/mp4',
          size: 1000,
        }).expect(201)
      ).body as UploadResult;

      const res = await call(
        app,
        coord,
        'post',
        `/training-modules/${c.moduleId}/files/${requested.fileId}/confirm`,
      ).expect(409);

      expect((res.body as ApiErrorBody).code).toBe('conflicto');
      expect(
        (await prisma.storedFile.findUniqueOrThrow({ where: { id: requested.fileId } })).status,
      ).toBe(StoredFileStatus.Rejected);
      expect(
        (await prisma.trainingModule.findUniqueOrThrow({ where: { id: c.moduleId } })).videoFileId,
      ).toBeNull();
      // Un archivo ya resuelto no se confirma de nuevo.
      await call(
        app,
        coord,
        'post',
        `/training-modules/${c.moduleId}/files/${requested.fileId}/confirm`,
      ).expect(409);
    });

    it('el almacenamiento rechaza una subida con otro tipo o tamaño y la confirmación falla con 409', async () => {
      const c = await course();
      const requested = (
        await request(c.moduleId, {
          purpose: 'video',
          name: 'mentira.mp4',
          contentType: 'video/mp4',
          size: 1000,
        }).expect(201)
      ).body as UploadResult;

      const wrongType = await fetch(requested.upload.url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: randomBytes(1000),
      });
      const wrongSize = await fetch(requested.upload.url, {
        method: 'PUT',
        headers: requested.upload.headers,
        body: randomBytes(1001),
      });

      expect(wrongType.status).toBeGreaterThanOrEqual(400);
      expect(wrongSize.status).toBeGreaterThanOrEqual(400);
      await call(
        app,
        coord,
        'post',
        `/training-modules/${c.moduleId}/files/${requested.fileId}/confirm`,
      ).expect(409);
      expect(await storage.head(await objectKeyOf(requested.fileId))).toBeNull();
    });

    it('un archivo de otro módulo es 404 y no se confirma', async () => {
      const a = await course();
      const b = await course();
      const requested = (
        await request(a.moduleId, {
          purpose: 'video',
          name: 'a.mp4',
          contentType: 'video/mp4',
          size: 10,
        }).expect(201)
      ).body as UploadResult;

      await call(
        app,
        coord,
        'post',
        `/training-modules/${b.moduleId}/files/${requested.fileId}/confirm`,
      ).expect(404);
      expect(
        (await prisma.storedFile.findUniqueOrThrow({ where: { id: requested.fileId } })).status,
      ).toBe(StoredFileStatus.Pending);
    });
  });

  describe('enlace y archivo se excluyen (R5, R6, R27, R28)', () => {
    it('el archivo sustituye al enlace, uno nuevo sustituye al anterior sin borrarlo y el enlace quita el archivo', async () => {
      const c = await course({ video: true });
      expect(
        (await prisma.trainingModule.findUniqueOrThrow({ where: { id: c.moduleId } })).videoUrl,
      ).toBe(YOUTUBE);

      const first = await attach(c.moduleId, 'video', 'video/mp4', randomBytes(500));
      expect(first.module).toMatchObject({ videoUrl: null, videoSource: 'archivo' });

      const second = await attach(c.moduleId, 'video', 'video/webm', randomBytes(700));
      expect(second.module.videoFile?.id).toBe(second.fileId);
      // El archivo sustituido y su objeto se conservan.
      expect(
        (await prisma.storedFile.findUniqueOrThrow({ where: { id: first.fileId } })).status,
      ).toBe(StoredFileStatus.Available);
      expect(await storage.head(await objectKeyOf(first.fileId))).toEqual({
        size: 500,
        contentType: 'video/mp4',
      });

      const patched = await call(app, coord, 'patch', `/training-modules/${c.moduleId}`)
        .send({ videoUrl: 'https://youtu.be/dQw4w9WgXcQ?t=90' })
        .expect(200);
      expect(patched.body).toMatchObject({
        videoFile: null,
        videoSource: 'youtube',
        videoUrl: 'https://youtu.be/dQw4w9WgXcQ?t=90',
        videoEmbedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90',
      });
      const row = await prisma.trainingModule.findUniqueOrThrow({ where: { id: c.moduleId } });
      expect(row.videoFileId).toBeNull();
      expect(
        (await prisma.storedFile.findUniqueOrThrow({ where: { id: second.fileId } })).status,
      ).toBe(StoredFileStatus.Available);
    });

    it('quitar el archivo conserva el registro y el objeto, y la segunda vez es 404', async () => {
      const c = await course();
      const { fileId } = await attach(c.moduleId, 'presentacion', 'image/png', randomBytes(300));

      const res = await call(
        app,
        coord,
        'delete',
        `/training-modules/${c.moduleId}/files/presentacion`,
      ).expect(200);

      expect(res.body).toMatchObject({ presentationFile: null });
      expect(await prisma.storedFile.count({ where: { id: fileId } })).toBe(1);
      expect(await storage.head(await objectKeyOf(fileId))).not.toBeNull();
      await call(app, coord, 'delete', `/training-modules/${c.moduleId}/files/presentacion`).expect(
        404,
      );
      await coordUrl(c.moduleId, 'presentacion').expect(404);
    });

    it('rechaza con 400 y mensaje en español un video que no es de YouTube; la presentación admite cualquier https', async () => {
      const c = await course();

      const res = await call(app, coord, 'patch', `/training-modules/${c.moduleId}`)
        .send({ videoUrl: 'https://vimeo.com/123456789' })
        .expect(400);
      await call(app, coord, 'patch', `/training-modules/${c.moduleId}`)
        .send({ presentationUrl: 'http://example.com/p.pdf' })
        .expect(400);
      await call(app, coord, 'patch', `/training-modules/${c.moduleId}`)
        .send({ presentationUrl: 'https://example.com/p.pdf' })
        .expect(200);

      expect(JSON.stringify(res.body)).toContain(
        'El video debe ser un enlace de YouTube (youtube.com o youtu.be).',
      );
      expect(
        (await prisma.trainingModule.findUniqueOrThrow({ where: { id: c.moduleId } })).videoUrl,
      ).toBe(YOUTUBE);
    });

    it('la ruta y el módulo del docente traen el origen del video y el enlace de inserción', async () => {
      const c = await course({ video: true });
      await call(app, coord, 'patch', `/training-modules/${c.moduleId}`)
        .send({ videoUrl: 'https://youtu.be/dQw4w9WgXcQ?t=1m30s' })
        .expect(200);

      const route = (await call(app, c.teacher, 'get', '/me/training/route').expect(200))
        .body as TeacherRoute;
      const summary = route.plans
        .flatMap((plan) => plan.sections.flatMap((section) => section.modules))
        .find((module) => module.id === c.moduleId);
      const detail = (
        await call(app, c.teacher, 'get', `/me/training/modules/${c.moduleId}`).expect(200)
      ).body as TeacherModule;

      for (const view of [summary, detail]) {
        expect(view).toMatchObject({
          videoSource: 'youtube',
          videoEmbedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90',
        });
      }
      expect(detail.videoUrl).toBe('https://youtu.be/dQw4w9WgXcQ?t=1m30s');
    });

    it('con archivo, el docente ve videoSource archivo y los metadatos sin ninguna URL firmada', async () => {
      const c = await course({ video: true });
      const { fileId } = await attach(c.moduleId, 'video', 'video/mp4', randomBytes(256), 'v.mp4');

      const detail = (
        await call(app, c.teacher, 'get', `/me/training/modules/${c.moduleId}`).expect(200)
      ).body as TeacherModule;

      expect(detail).toMatchObject({
        videoUrl: null,
        videoSource: 'archivo',
        videoEmbedUrl: null,
        videoFile: { id: fileId, name: 'v.mp4', contentType: 'video/mp4', size: 256 },
      });
      expect(JSON.stringify(detail)).not.toMatch(/X-Amz|formacion\/modulos|https?:\/\/(?!youtu)/);
    });
  });

  describe('docente (R7, R9)', () => {
    it('recibe la URL de un módulo de su ruta y descarga los mismos bytes', async () => {
      const c = await course();
      const bytes = randomBytes(1024);
      await attach(c.moduleId, 'video', 'video/mp4', bytes);

      const res = await teacherUrl(c, c.moduleId, 'video').expect(200);
      const { url, expiresAt } = res.body as UrlResult;

      expect(Math.abs(secondsLeft(expiresAt) - VIEW_TTL_SECONDS)).toBeLessThan(30);
      expect(Buffer.from(await (await fetch(url)).arrayBuffer()).equals(bytes)).toBe(true);
    });

    it('responde 404 fuera de su ruta, sin archivo y para un módulo que no existe', async () => {
      const mine = await course();
      const other = await course();
      await attach(other.moduleId, 'video', 'video/mp4', randomBytes(100));

      await teacherUrl(mine, other.moduleId, 'video').expect(404);
      await teacherUrl(mine, mine.moduleId, 'video').expect(404);
      await teacherUrl(mine, '00000000-0000-4000-8000-000000000000', 'video').expect(404);
    });

    it('un módulo con el video solo como archivo exige verlo para terminar (R9)', async () => {
      const c = await course({ video: true });
      await attach(c.moduleId, 'video', 'video/mp4', randomBytes(200));

      const route = (await call(app, c.teacher, 'get', '/me/training/route').expect(200))
        .body as TeacherRoute;
      const summary = route.plans
        .flatMap((plan) => plan.sections.flatMap((section) => section.modules))
        .find((module) => module.id === c.moduleId);
      expect(summary?.steps.video).toBe(true);
      expect(summary?.completedAt).toBeNull();

      const mark = await call(
        app,
        c.teacher,
        'post',
        `/me/training/modules/${c.moduleId}/video-viewed`,
      ).expect(200);

      expect((mark.body as { completedAt: string | null }).completedAt).not.toBeNull();
      expect(await milestonesOf(app, c.user.id)).toContain('Terminó un módulo');
    });

    it('un docente recibe 403 en todas las rutas de coordinación de archivos', async () => {
      const c = await course();
      const t = c.teacher;
      const id = c.moduleId;
      const file = '00000000-0000-4000-8000-000000000001';

      await call(app, t, 'post', `/training-modules/${id}/files`)
        .send({ purpose: 'video', name: 'a.mp4', contentType: 'video/mp4', size: 10 })
        .expect(403);
      await call(app, t, 'post', `/training-modules/${id}/files/${file}/confirm`).expect(403);
      await call(app, t, 'delete', `/training-modules/${id}/files/video`).expect(403);
      await call(app, t, 'post', `/training-modules/${id}/files/video/url`).expect(403);
    });
  });

  describe('bitácora (R25)', () => {
    it('registra la solicitud, el adjunto y la baja sin URL firmadas ni claves de objeto', async () => {
      const c = await course();
      const { fileId } = await attach(c.moduleId, 'video', 'video/mp4', randomBytes(128));
      await coordUrl(c.moduleId, 'video').expect(200);
      await call(app, coord, 'delete', `/training-modules/${c.moduleId}/files/video`).expect(200);

      const rows = await trainingAudit(app, c.moduleId);
      const actions = rows.map((row) => row.action);

      expect(actions).toEqual(
        expect.arrayContaining([
          'Solicitó subir un archivo a un módulo de formación',
          'Adjuntó un archivo a un módulo de formación',
          'Quitó un archivo de un módulo de formación',
        ]),
      );
      // La lectura de la URL no se audita.
      expect(actions.filter((action) => action.includes('URL'))).toEqual([]);
      const text = JSON.stringify(rows, (_key, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value,
      );
      expect(text).toContain(fileId);
      expect(text).not.toMatch(
        /X-Amz|formacion\/modulos|https?:\/\/[^"]*amazonaws|127\.0\.0\.1:\d+/,
      );
      expect(text).not.toContain(await objectKeyOf(fileId));
    });
  });

  describe('almacenamiento caído (R10)', () => {
    it('un almacenamiento que acepta la conexión y no responde da 503 en pocos segundos y sin cambios en la base', async () => {
      const sockets: Socket[] = [];
      const silent = createServer((socket) => sockets.push(socket));
      await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));
      const { port } = silent.address() as { port: number };
      const hungApp = await createTestApp({
        withFailures: false,
        config: { STORAGE_ENDPOINT: `http://127.0.0.1:${port}` },
      });
      try {
        const c = await course();
        const requested = (
          await request(c.moduleId, {
            purpose: 'video',
            name: 'mudo.mp4',
            contentType: 'video/mp4',
            size: 100,
          }).expect(201)
        ).body as UploadResult;

        const started = Date.now();
        const res = await call(
          hungApp,
          coord,
          'post',
          `/training-modules/${c.moduleId}/files/${requested.fileId}/confirm`,
        ).expect(503);

        expect(Date.now() - started).toBeLessThan(5000);
        expect(res.body).toMatchObject({ code: 'almacenamiento_no_disponible' });
        expect(
          (await prisma.storedFile.findUniqueOrThrow({ where: { id: requested.fileId } })).status,
        ).toBe(StoredFileStatus.Pending);
        expect(
          (await prisma.trainingModule.findUniqueOrThrow({ where: { id: c.moduleId } }))
            .videoFileId,
        ).toBeNull();
      } finally {
        await hungApp.close();
        sockets.forEach((socket) => socket.destroy());
        await new Promise((resolve) => silent.close(resolve));
      }
    });

    it('responde 503 con código estable y no cambia la base de datos', async () => {
      const deadApp = await createTestApp({
        withFailures: false,
        config: { STORAGE_ENDPOINT: 'http://127.0.0.1:9' },
      });
      try {
        const c = await course();
        const requested = (
          await request(c.moduleId, {
            purpose: 'video',
            name: 'caido.mp4',
            contentType: 'video/mp4',
            size: 100,
          }).expect(201)
        ).body as UploadResult;

        const res = await call(
          deadApp,
          coord,
          'post',
          `/training-modules/${c.moduleId}/files/${requested.fileId}/confirm`,
        ).expect(503);

        expect(res.body).toMatchObject({
          statusCode: 503,
          code: 'almacenamiento_no_disponible',
        });
        expect(JSON.stringify(res.body)).not.toMatch(/127\.0\.0\.1|ECONNREFUSED/);
        expect(
          (await prisma.storedFile.findUniqueOrThrow({ where: { id: requested.fileId } })).status,
        ).toBe(StoredFileStatus.Pending);
        expect(
          (await prisma.trainingModule.findUniqueOrThrow({ where: { id: c.moduleId } }))
            .videoFileId,
        ).toBeNull();
      } finally {
        await deadApp.close();
      }
    });
  });
});
