import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema } from '@gns/shared';
import request from 'supertest';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import {
  ALLOWED_ORIGIN,
  asUser,
  createTestUser,
  randomPassword,
  serverOf,
  setCookiesOf,
  signIn,
} from './support/session';

const FOREIGN_ORIGIN = 'https://intruso.test';

describe('rechazo de escrituras desde un origen no permitido (R21)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([FOREIGN_ORIGIN, 'null', 'http://localhost:3001.intruso.test'])(
    'responde 403 sin ejecutar un ingreso con Origin %s, aunque las credenciales sean correctas',
    async (origin) => {
      const user = await createTestUser(app);

      const res = await request(serverOf(app))
        .post('/auth/login')
        .set('Origin', origin)
        .send({ email: user.email, password: user.password })
        .expect(403);

      const body = apiErrorBodySchema.parse(res.body);
      expect(body).toMatchObject({ statusCode: 403, code: 'sin_permiso' });
      expect(body.requestId).toBe(res.headers['x-request-id']);
      expect(setCookiesOf(res)).toEqual([]);
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    },
  );

  it('bloquea también PUT, PATCH y DELETE desde un origen ajeno', async () => {
    const user = await createTestUser(app);
    const cookies = await signIn(app, user);

    await asUser(app, 'put', '/auth/password', cookies, 'access')
      .set('Origin', FOREIGN_ORIGIN)
      .send({ currentPassword: user.password, newPassword: randomPassword() })
      .expect(403);
    await request(serverOf(app))
      .patch(`/users/${user.id}`)
      .set('Origin', FOREIGN_ORIGIN)
      .expect(403);
    await request(serverOf(app))
      .delete(`/users/${user.id}`)
      .set('Origin', FOREIGN_ORIGIN)
      .expect(403);
    // La contraseña no cambió.
    await signIn(app, user);
  });

  it('permite el origen configurado y las peticiones sin Origin', async () => {
    const user = await createTestUser(app);

    await request(serverOf(app))
      .post('/auth/login')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ email: user.email, password: user.password })
      .expect(200);
    await request(serverOf(app))
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);
  });

  it('no restringe las lecturas', async () => {
    await request(serverOf(app)).get('/faq-example').set('Origin', FOREIGN_ORIGIN).expect(200);
  });
});
