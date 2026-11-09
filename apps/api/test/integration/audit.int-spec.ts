import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { BAD_AUDIT_CATEGORY, FAILING_CATEGORY } from './support/failure.controller';

interface FaqBody {
  id: string;
}

describe('auditoría automática en la bitácora', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  const category = `audit-${randomUUID().slice(0, 8)}`;
  const server = () => app.getHttpServer() as Server;

  beforeAll(async () => {
    app = await createTestApp({
      // Simula la sesión que BE-3 adjuntará a `request.user`.
      beforeInit: (instance) => {
        instance.use(
          (
            req: { headers: Record<string, string>; user?: unknown },
            _res: unknown,
            next: () => void,
          ) => {
            if (req.headers['x-test-user']) {
              req.user = { id: req.headers['x-test-user'], role: 'coordinador' };
            }
            next();
          },
        );
      },
    });
    prisma = app.get(PrismaService);
    const user = await prisma.user.create({
      data: {
        fullName: 'Coordinadora de prueba',
        institutionalEmail: `${randomUUID()}@auditoria.test`,
        role: 'coordinador',
        status: 'activo',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    // Las filas de bitácora no se pueden borrar: solo se limpian las de negocio.
    await prisma.faqEntry.deleteMany({
      where: { category: { in: [category, FAILING_CATEGORY, BAD_AUDIT_CATEGORY] } },
    });
    await app.close();
  });

  const createFaq = (headers: Record<string, string> = {}) =>
    request(server())
      .post('/faq-example')
      .set(headers)
      .send({ category, question: 'Pregunta original', answer: 'Respuesta original' });

  const auditRows = (where: object) => prisma.auditLog.findMany({ where, orderBy: { id: 'asc' } });

  it('registra la creación con antes nulo y después con el registro guardado', async () => {
    const started = Date.now();
    const res = await createFaq().expect(201);
    const { id } = res.body as FaqBody;

    const rows = await auditRows({ entityId: id });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: null,
      role: 'desconocido',
      type: 'asistente',
      action: 'Crear pregunta frecuente',
      entity: 'pregunta_frecuente',
      entityId: id,
      dataBefore: null,
    });
    expect(rows[0]?.dataAfter).toMatchObject({
      id,
      category,
      question: 'Pregunta original',
      answer: 'Respuesta original',
      isActive: false,
    });
    // La hora la pone el servidor de base de datos.
    expect(rows[0]?.occurredAt.getTime()).toBeGreaterThan(started - 60_000);
  });

  it('registra el usuario y el rol de la sesión', async () => {
    const { id } = (await createFaq({ 'x-test-user': userId }).expect(201)).body as FaqBody;
    const [row] = await auditRows({ entityId: id });
    expect(row).toMatchObject({ userId, role: 'coordinador' });
  });

  it('registra una edición con solo los campos que cambiaron en ambos lados', async () => {
    const { id } = (await createFaq().expect(201)).body as FaqBody;
    await request(server())
      .patch(`/faq-example/${id}`)
      .send({ answer: 'Respuesta nueva', question: 'Pregunta original' })
      .expect(200);

    const rows = await auditRows({ entityId: id, action: 'Editar pregunta frecuente' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.dataBefore).toEqual({ answer: 'Respuesta original' });
    expect(rows[0]?.dataAfter).toEqual({ answer: 'Respuesta nueva' });
  });

  it('no registra nada cuando la petición es inválida o el registro no existe', async () => {
    const { id } = (await createFaq().expect(201)).body as FaqBody;
    const before = await prisma.auditLog.count({ where: { action: 'Editar pregunta frecuente' } });

    await request(server()).patch(`/faq-example/${id}`).send({ extra: 1 }).expect(400);
    await request(server()).patch('/faq-example/no-es-uuid').send({ answer: 'x' }).expect(400);
    await request(server()).patch(`/faq-example/${randomUUID()}`).send({ answer: 'x' }).expect(404);

    const after = await prisma.auditLog.count({ where: { action: 'Editar pregunta frecuente' } });
    expect(after).toBe(before);
  });

  it('no escribe en la bitácora ni deja datos cuando el endpoint falla', async () => {
    const before = await prisma.auditLog.count({ where: { action: 'Acción que falla' } });

    await request(server()).post('/failures/failing-audited').expect(409);

    expect(await prisma.auditLog.count({ where: { action: 'Acción que falla' } })).toBe(before);
    expect(await prisma.faqEntry.count({ where: { category: FAILING_CATEGORY } })).toBe(0);
  });

  it('revierte la operación y responde 500 si falla la escritura en la bitácora', async () => {
    const res = await request(server()).post('/failures/bad-audit').expect(500);

    expect(res.body).toMatchObject({
      code: 'error_interno',
      message: 'Ocurrió un error inesperado',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/bitacora|tipo|check/i);
    expect(await prisma.faqEntry.count({ where: { category: BAD_AUDIT_CATEGORY } })).toBe(0);
  });

  it('oculta los campos secretos y limita cada lado a 64 KB', async () => {
    await request(server()).post('/failures/audited-secret').expect(201);
    const [secret] = await prisma.auditLog.findMany({
      where: { action: 'Acción con secretos' },
      orderBy: { id: 'desc' },
      take: 1,
    });
    expect(secret?.dataAfter).toMatchObject({
      nombre: 'Sofía',
      passwordHash: '[oculto]',
      nested: { token: '[oculto]' },
    });
    expect(JSON.stringify(secret?.dataAfter)).not.toMatch(/super-secreto/);

    await request(server()).post('/failures/audited-big').expect(201);
    const [big] = await prisma.auditLog.findMany({
      where: { action: 'Acción con datos grandes' },
      orderBy: { id: 'desc' },
      take: 1,
    });
    expect(big?.dataAfter).toEqual({ _omitido: 'excede 64 KB', campos: ['id', 'notas', 'otro'] });
  });
});

describe('privilegios de la aplicación sobre la bitácora', () => {
  const statements = [
    "UPDATE bitacora SET detalle = 'cambiado'",
    'DELETE FROM bitacora',
    'TRUNCATE bitacora',
  ];
  let app: Client;
  let admin: Client;
  let rowId: bigint;

  beforeAll(async () => {
    app = new Client({ connectionString: process.env.DATABASE_URL });
    admin = new Client({ connectionString: process.env.TEST_ADMIN_DATABASE_URL });
    await Promise.all([app.connect(), admin.connect()]);
    const inserted = await app.query<{ id: string }>(
      `INSERT INTO bitacora (rol, tipo, accion, detalle) VALUES ('desconocido', 'ingreso', 'Prueba de privilegios', 'original') RETURNING id`,
    );
    rowId = BigInt(inserted.rows[0]?.id ?? '0');
  });

  afterAll(async () => {
    await Promise.all([app.end(), admin.end()]);
  });

  const detailOf = async () =>
    (await admin.query<{ detalle: string }>('SELECT detalle FROM bitacora WHERE id = $1', [rowId]))
      .rows[0]?.detalle;

  const codeOf = async (client: Client, sql: string) => {
    try {
      await client.query(sql);
    } catch (error) {
      return (error as { code?: string }).code;
    }
    return undefined;
  };

  it.each(statements)('con el usuario de la aplicación %s falla por privilegios', async (sql) => {
    expect(await codeOf(app, sql)).toBe('42501');
    expect(await detailOf()).toBe('original');
  });

  it.each(statements)('con el superusuario %s lo rechaza el trigger', async (sql) => {
    expect(await codeOf(admin, sql)).toBe('P0001');
    expect(await detailOf()).toBe('original');
  });
});
