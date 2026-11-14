import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { apiErrorBodySchema, ApiErrorCode, UserRole, UserStatus } from '@gns/shared';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/core/bootstrap/configure-app';
import { AUDIT_LOG_EXPORT_LIMIT } from '../../src/modules/auditoria/audit-log-query.service';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { asUser, createTestUser, signIn, type Cookies, type TestUser } from './support/session';
import { createTestApp } from './support/create-test-app';

interface EntryBody {
  id: string;
  occurredAt: string;
  user: { id: string; name: string } | null;
  role: string;
  type: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  detail: string | null;
}
interface PageBody {
  items: EntryBody[];
  nextCursor: string | null;
}

interface SeedRow {
  occurredAt: string;
  role: string;
  type: string;
  action: string;
  detail?: string;
  dataBefore?: object;
  dataAfter?: object;
}

// Fechas fijas en UTC; entre paréntesis, la hora de Colombia (UTC-5).
const SEED: SeedRow[] = [
  // 2026-03-09 23:59:59
  { occurredAt: '2026-03-10T04:59:59Z', role: 'docente', type: 'planeacion', action: 'Fila 1' },
  // 2026-03-10 00:00:00
  { occurredAt: '2026-03-10T05:00:00Z', role: 'docente', type: 'ingreso', action: 'Fila 2' },
  // 2026-03-10 23:30:00
  {
    occurredAt: '2026-03-11T04:30:00Z',
    role: 'coordinador',
    type: 'planeacion',
    action: '=2+2',
    detail: 'Texto; con separador',
  },
  // Cuatro filas con la misma fecha y hora: el orden lo desempata el consecutivo.
  { occurredAt: '2026-03-12T15:00:00Z', role: 'docente', type: 'diario', action: 'Fila 4' },
  { occurredAt: '2026-03-12T15:00:00Z', role: 'docente', type: 'diario', action: 'Fila 5' },
  { occurredAt: '2026-03-12T15:00:00Z', role: 'docente', type: 'diario', action: 'Fila 6' },
  {
    occurredAt: '2026-03-12T15:00:00Z',
    role: 'docente',
    type: 'observador',
    action: 'Fila 7',
    detail: 'Cambio de la observación',
    dataBefore: { text: '[oculto]' },
    dataAfter: { text: '[oculto]', status: 'enviada' },
  },
];

describe('consulta y exportación de la bitácora (BE-9)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let coordUser: TestUser;
  let coord: Cookies;
  let teacher: Cookies;
  let teacherUser: TestUser;
  let admin: Cookies;
  let subjectId: string;
  /** Consecutivos de las filas de `SEED` del sujeto, en el orden de inserción. */
  let seeded: string[];

  /** Orden esperado: de la más reciente a la más antigua, con desempate por consecutivo. */
  const newestFirst = (ids: string[], rows: SeedRow[]) =>
    ids
      .map((id, index) => ({ id, at: new Date(rows[index]?.occurredAt ?? '').getTime() }))
      .sort((a, b) => b.at - a.at || Number(BigInt(b.id) - BigInt(a.id)))
      .map((row) => row.id);

  async function seed(userId: string): Promise<string[]> {
    const ids: string[] = [];
    for (const row of SEED) {
      const created = await prisma.auditLog.create({
        data: {
          userId,
          occurredAt: new Date(row.occurredAt),
          role: row.role,
          type: row.type,
          action: row.action,
          detail: row.detail ?? null,
          dataBefore: row.dataBefore ?? undefined,
          dataAfter: row.dataAfter ?? undefined,
        },
      });
      ids.push(created.id.toString());
    }
    return ids;
  }

  async function createSubject(): Promise<string> {
    const user = await prisma.user.create({
      data: {
        fullName: 'Persona de la bitácora',
        institutionalEmail: `${randomUUID().slice(0, 12)}@bitacora.test`,
        role: UserRole.Teacher,
        status: UserStatus.Active,
      },
    });
    return user.id;
  }

  const get = (path: string, cookies: Cookies = coord) => asUser(app, 'get', path, cookies);
  const page = async (query: string): Promise<PageBody> =>
    (await get(`/audit-log?${query}`).expect(200)).body as PageBody;
  const ownRows = (userId: string) => prisma.auditLog.count({ where: { userId } });

  beforeAll(async () => {
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    coordUser = await createTestUser(app, { role: UserRole.Coordinator });
    coord = await signIn(app, coordUser);
    teacherUser = await createTestUser(app, { role: UserRole.Teacher });
    teacher = await signIn(app, teacherUser);
    admin = await signIn(app, await createTestUser(app, { role: UserRole.Administrator }));
    subjectId = await createSubject();
    seeded = await seed(subjectId);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('acceso (R1, R2)', () => {
    const paths = ['/audit-log', '/audit-log/export', '/audit-log/1'];

    it.each(paths)('GET %s responde 403 al docente sin filas ni registro', async (path) => {
      const before = await ownRows(teacherUser.id);

      const res = await get(path, teacher).expect(403);

      expect(apiErrorBodySchema.parse(res.body).code).toBe(ApiErrorCode.Forbidden);
      expect(res.text).not.toContain('Fila');
      expect(await ownRows(teacherUser.id)).toBe(before);
    });

    it('coordinación entra en las tres rutas', async () => {
      await get('/audit-log?limit=1').expect(200);
      await get('/audit-log/export?userId=' + randomUUID()).expect(200);
      await get(`/audit-log/${seeded[0]}`).expect(200);
    });

    it('administración hereda el acceso por la jerarquía de RequireRole', async () => {
      await get('/audit-log?limit=1', admin).expect(200);
    });

    it.each(['post', 'put', 'patch', 'delete'] as const)(
      '%s sobre las rutas de la bitácora responde 404 y no cambia las filas',
      async (method) => {
        const before = await prisma.auditLog.count();
        const own = await ownRows(subjectId);

        for (const path of ['/audit-log', `/audit-log/${seeded[0]}`, '/audit-log/export']) {
          await asUser(app, method, path, coord).send({}).expect(404);
        }

        expect(await ownRows(subjectId)).toBe(own);
        // Otras suites escriben en paralelo: solo puede haber crecido.
        expect(await prisma.auditLog.count()).toBeGreaterThanOrEqual(before);
      },
    );
  });

  describe('listado y cursor (R3, R4, R5, R8)', () => {
    it('devuelve las filas de la más reciente a la más antigua, con desempate por consecutivo', async () => {
      const body = await page(`userId=${subjectId}`);

      expect(body.items.map((item) => item.id)).toEqual(newestFirst(seeded, SEED));
      expect(body.nextCursor).toBeNull();
    });

    it('cada fila trae el consecutivo como texto, la fecha ISO, el usuario y nada más', async () => {
      const body = await page(`userId=${subjectId}&type=observador`);

      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toEqual({
        id: seeded[6],
        occurredAt: '2026-03-12T15:00:00.000Z',
        user: { id: subjectId, name: 'Persona de la bitácora' },
        role: 'docente',
        type: 'observador',
        action: 'Fila 7',
        entity: null,
        entityId: null,
        detail: 'Cambio de la observación',
      });
    });

    it('recorre todo con el cursor sin repetir ni omitir, aunque entren filas nuevas', async () => {
      const userId = await createSubject();
      const ids = await seed(userId);
      const expected = newestFirst(ids, SEED);

      const first = await page(`userId=${userId}&limit=2`);
      expect(first.items.map((item) => item.id)).toEqual(expected.slice(0, 2));
      expect(first.nextCursor).toBe(expected[1]);

      // Una fila más reciente que todas llega a mitad del recorrido: no debe aparecer ni correr nada.
      await prisma.auditLog.create({
        data: {
          userId,
          occurredAt: new Date('2026-04-01T12:00:00Z'),
          role: 'docente',
          type: 'diario',
          action: 'Fila nueva',
        },
      });

      const seen = [...first.items.map((item) => item.id)];
      let cursor = first.nextCursor;
      let pages = 1;
      while (cursor) {
        const next = await page(`userId=${userId}&limit=2&cursor=${cursor}`);
        seen.push(...next.items.map((item) => item.id));
        cursor = next.nextCursor;
        pages += 1;
      }

      expect(seen).toEqual(expected);
      expect(pages).toBe(4);
      expect((await page(`userId=${userId}&limit=1`)).items[0]?.action).toBe('Fila nueva');
    });

    it('un cursor con formato válido que no existe devuelve una página vacía', async () => {
      const body = await page(`userId=${subjectId}&cursor=999999999999999`);

      expect(body).toEqual({ items: [], nextCursor: null });
    });

    it('usa 20 filas por defecto y respeta el máximo de 100', async () => {
      expect((await page('')).items.length).toBeLessThanOrEqual(20);
      expect((await page('limit=100')).items.length).toBeLessThanOrEqual(100);
    });

    it.each([
      ['limit=0'],
      ['limit=101'],
      ['limit=x'],
      ['cursor=abc'],
      ['cursor=-1'],
      ['userId=1'],
      ['role=rector'],
      ['type=otro'],
      ['from=14/11/2026'],
      ['to=2026-02-30'],
      ['page=2'],
      ['from=2026-03-11&to=2026-03-10'],
    ])('rechaza la query %s con 400 validacion', async (query) => {
      const res = await get(`/audit-log?${query}`).expect(400);

      expect(apiErrorBodySchema.parse(res.body).code).toBe(ApiErrorCode.Validation);
    });

    it('reporta from posterior a to sobre el campo to', async () => {
      const res = await get('/audit-log?from=2026-03-11&to=2026-03-10').expect(400);

      expect(apiErrorBodySchema.parse(res.body).errors?.[0]?.field).toBe('to');
    });
  });

  describe('filtros (R6, R7)', () => {
    const actions = async (query: string) =>
      (await page(`userId=${subjectId}&${query}`)).items.map((item) => item.action).sort();

    it('filtra por rol', async () => {
      expect(await actions('role=coordinador')).toEqual(['=2+2']);
    });

    it('filtra por tipo', async () => {
      expect(await actions('type=ingreso')).toEqual(['Fila 2']);
    });

    it('filtra por usuario: solo trae las filas de ese usuario', async () => {
      const body = await page(`userId=${subjectId}&limit=100`);

      expect(body.items).toHaveLength(SEED.length);
      expect(body.items.every((item) => item.user?.id === subjectId)).toBe(true);
    });

    it('acepta el rol desconocido', async () => {
      const res = await get('/audit-log?role=desconocido&limit=5').expect(200);

      expect((res.body as PageBody).items.every((item) => item.role === 'desconocido')).toBe(true);
    });

    it('interpreta las fechas como días completos en la hora de Colombia, con ambos extremos', async () => {
      // Fila 1: 23:59:59 del 9; Fila 2: 00:00:00 del 10; Fila 3: 23:30 del 10.
      expect(await actions('from=2026-03-10&to=2026-03-10')).toEqual(['=2+2', 'Fila 2']);
      expect(await actions('from=2026-03-09&to=2026-03-09')).toEqual(['Fila 1']);
      expect(await actions('from=2026-03-11&to=2026-03-11')).toEqual([]);
      expect(await actions('from=2026-03-12')).toEqual(['Fila 4', 'Fila 5', 'Fila 6', 'Fila 7']);
      expect(await actions('to=2026-03-09')).toEqual(['Fila 1']);
    });

    it('combina todos los filtros', async () => {
      expect(await actions('role=docente&type=planeacion&from=2026-03-01&to=2026-03-10')).toEqual([
        'Fila 1',
      ]);
      expect(await actions('role=coordinador&type=ingreso')).toEqual([]);
    });

    it('un usuario sin filas devuelve una página vacía', async () => {
      expect(await page(`userId=${randomUUID()}`)).toEqual({ items: [], nextCursor: null });
    });
  });

  describe('detalle (R9, R10)', () => {
    it('devuelve los datos antes y después tal como se guardaron, sin correo', async () => {
      const res = await get(`/audit-log/${seeded[6]}`).expect(200);
      const body = res.body as EntryBody & { dataBefore: unknown; dataAfter: unknown };

      expect(body).toMatchObject({
        id: seeded[6],
        action: 'Fila 7',
        user: { id: subjectId, name: 'Persona de la bitácora' },
        dataBefore: { text: '[oculto]' },
        dataAfter: { text: '[oculto]', status: 'enviada' },
      });
      expect(res.text).not.toContain('@bitacora.test');
      expect(Object.keys(body.user ?? {}).sort()).toEqual(['id', 'name']);
    });

    it('devuelve nulos cuando la fila no guardó datos', async () => {
      const body = (await get(`/audit-log/${seeded[0]}`).expect(200)).body as {
        dataBefore: unknown;
        dataAfter: unknown;
      };

      expect(body.dataBefore).toBeNull();
      expect(body.dataAfter).toBeNull();
    });

    it('responde 404 no_encontrado si el consecutivo no existe', async () => {
      const res = await get('/audit-log/999999999999999').expect(404);

      expect(apiErrorBodySchema.parse(res.body).code).toBe(ApiErrorCode.NotFound);
    });

    it('responde 400 si el identificador no son dígitos', async () => {
      await get('/audit-log/abc').expect(400);
    });

    it('el listado no incluye los datos antes y después (D3)', async () => {
      const body = await page(`userId=${subjectId}&type=observador`);

      expect(JSON.stringify(body)).not.toContain('oculto');
      expect(Object.keys(body.items[0] ?? {})).not.toContain('dataBefore');
    });
  });

  describe('lecturas sin bitácora (R16)', () => {
    it('listar, ver el detalle y fallar no escriben filas del usuario', async () => {
      const before = await ownRows(coordUser.id);

      await page(`userId=${subjectId}&limit=2`);
      await get(`/audit-log/${seeded[2]}`).expect(200);
      await get('/audit-log/999999999999999').expect(404);
      await get('/audit-log?limit=0').expect(400);

      expect(await ownRows(coordUser.id)).toBe(before);
    });
  });

  describe('exportación CSV (R11, R12, R14)', () => {
    const exportRows = () =>
      prisma.auditLog.findMany({
        where: { userId: coordUser.id, action: 'Exportó la bitácora' },
        orderBy: { id: 'asc' },
      });

    it('devuelve UTF-8 con BOM y ; con las columnas, la hora de Colombia y las fórmulas neutralizadas', async () => {
      const res = await get(`/audit-log/export?userId=${subjectId}&from=2026-03-10&to=2026-03-10`)
        .buffer(true)
        .parse((response, done) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      const bytes = res.body as Buffer;

      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="bitacora-\d{4}-\d{2}-\d{2}\.csv"$/,
      );
      expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      const lines = bytes.toString('utf8').slice(1).split('\r\n');
      expect(lines[0]).toBe(
        'N.º;Fecha y hora;Usuario;Rol;Tipo;Acción;Entidad;ID de la entidad;Detalle',
      );
      // Más reciente primero: la fila de las 23:30 y luego la de las 00:00.
      expect(lines[1]).toBe(
        `${seeded[2]};2026-03-10 23:30:00;Persona de la bitácora;coordinador;planeacion;'=2+2;;;"Texto; con separador"`,
      );
      expect(lines[2]).toBe(
        `${seeded[1]};2026-03-10 00:00:00;Persona de la bitácora;docente;ingreso;Fila 2;;;`,
      );
      expect(lines[3]).toBe('');
      expect(bytes.toString('utf8')).not.toContain('oculto');
    });

    it('exporta en el mismo orden que el listado y sin datos antes y después', async () => {
      const res = await get(`/audit-log/export?userId=${subjectId}`).expect(200);
      const ids = res.text
        .split('\r\n')
        .slice(1)
        .filter(Boolean)
        .map((line) => line.split(';')[0]);

      expect(ids).toEqual(newestFirst(seeded, SEED));
      expect(res.text).not.toContain('enviada');
    });

    it('deja una fila con los filtros y el número de filas, sin contenido (R14)', async () => {
      const before = (await exportRows()).length;

      await get(`/audit-log/export?userId=${subjectId}&type=diario&from=2026-03-01`).expect(200);

      const rows = await exportRows();
      expect(rows).toHaveLength(before + 1);
      const row = rows.at(-1);
      expect(row).toMatchObject({
        role: 'coordinador',
        type: 'coordinacion',
        entity: 'bitacora',
        entityId: null,
        dataBefore: null,
        dataAfter: {
          filters: { userId: subjectId, type: 'diario', from: '2026-03-01' },
          rows: 3,
        },
      });
      expect(JSON.stringify({ ...row, id: undefined })).not.toContain('Fila 4');
    });

    it('rechaza una query inválida sin registrar', async () => {
      const before = (await exportRows()).length;

      await get('/audit-log/export?limit=5').expect(400);
      await get('/audit-log/export?from=2026-03-11&to=2026-03-10').expect(400);

      expect(await exportRows()).toHaveLength(before);
    });
  });

  describe('límite de la exportación (R13)', () => {
    let limited: INestApplication;
    let limitedCoord: Cookies;

    beforeAll(async () => {
      const testing = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(AUDIT_LOG_EXPORT_LIMIT)
        .useValue(3)
        .compile();
      limited = testing.createNestApplication({ bufferLogs: true });
      configureApp(limited);
      await limited.init();
      limitedCoord = await signIn(limited, coordUser);
    });

    afterAll(async () => {
      await limited.close();
    });

    const exportRows = () =>
      prisma.auditLog.count({ where: { userId: coordUser.id, action: 'Exportó la bitácora' } });

    it('responde 422 exportacion_excede_limite sobre el tope, sin CSV ni registro', async () => {
      const before = await exportRows();

      const res = await asUser(
        limited,
        'get',
        `/audit-log/export?userId=${subjectId}`,
        limitedCoord,
      ).expect(422);

      const body = apiErrorBodySchema.parse(res.body);
      expect(body.code).toBe(ApiErrorCode.ExportExceedsLimit);
      expect(body.message).toContain('acota');
      expect(res.headers['content-disposition']).toBeUndefined();
      expect(await exportRows()).toBe(before);
    });

    it('exporta cuando las filas son exactamente el tope', async () => {
      const before = await exportRows();

      const res = await asUser(
        limited,
        'get',
        `/audit-log/export?userId=${subjectId}&type=diario`,
        limitedCoord,
      ).expect(200);

      expect(res.text.split('\r\n').filter(Boolean)).toHaveLength(4);
      expect(await exportRows()).toBe(before + 1);
    });
  });
});
