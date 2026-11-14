import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  apiErrorBodySchema,
  ApiErrorCode,
  type AuditLogEntry,
  type AuditLogPage,
  type MyAssignments,
  type UserRole,
} from '@gns/shared';
import request from 'supertest';
import { DEMO_EMAIL_DOMAIN, DEMO_USERS } from '../../../prisma/seed/demo/demo.data.ts';
import { createTestApp } from '../../integration/support/create-test-app';
import {
  ALLOWED_ORIGIN,
  cookieHeader,
  cookiesFrom,
  serverOf,
  type Cookies,
} from '../../integration/support/session';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

const ALL_BOXES = { policy: true, authorization: true, minors: true, security: true };

/** Sesión de un usuario demo, tal como la tendría el navegador (cookies y `Origin`). */
export interface DemoSession {
  key: string;
  id: string;
  name: string;
  role: UserRole;
  /** Pide `path` con las cookies de la sesión y la cabecera `Origin` permitida. */
  call(method: Method, path: string): request.Test;
}

/**
 * Mundo de las pruebas de punta a punta: la aplicación completa sobre los datos demo y las
 * sesiones de sus usuarios. Todo pasa por HTTP; lo que sabe de los datos demo lo importa de sus
 * archivos de datos, nunca de la API ni de la base.
 */
export class DemoWorld {
  /** Valores que nunca deben aparecer en una bitácora, un CSV ni un error (R7). */
  private readonly secrets: string[] = [];
  private readonly sessions = new Map<string, DemoSession>();

  private constructor(
    readonly app: INestApplication,
    private readonly admin: DemoSession,
  ) {}

  static async start(): Promise<DemoWorld> {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error('Falta el administrador de las pruebas de punta a punta (global-setup).');
    }
    const app = await createTestApp({ withFailures: false });
    const login = await request(serverOf(app))
      .post('/auth/login')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ email, password })
      .expect(200);
    const cookies = cookiesFrom(login);
    const me = await sessionCall(app, cookies, 'get', '/auth/me').expect(200);
    const admin = toSession(app, cookies, {
      key: 'administrador',
      id: (me.body as { id: string }).id,
      name: (me.body as { fullName: string }).fullName,
      role: (me.body as { role: UserRole }).role,
    });
    // La base vive durante toda la ejecución: el administrador acepta en el primer recorrido.
    if (!(await acceptedConsent(admin))) {
      await acceptConsent(admin);
    }
    const world = new DemoWorld(app, admin);
    world.secrets.push(password, cookies.access, cookies.refresh);
    return world;
  }

  async close(): Promise<void> {
    await this.app.close();
  }

  /**
   * Ingresa como un usuario demo. El administrador le asigna una contraseña aleatoria por la
   * API; la primera vez que el usuario entra se comprueba que sin aceptar el aviso de datos todo
   * responde 403 `consentimiento_requerido` (R3) y, tras aceptarlo por la API, la misma
   * petición pasa.
   */
  async signInAs(key: string): Promise<DemoSession> {
    const existing = this.sessions.get(key);
    if (existing) {
      return existing;
    }
    const demo = DEMO_USERS.find((user) => user.key === key);
    if (!demo) {
      throw new Error(`No existe el usuario demo ${key}`);
    }
    const found = await this.admin
      .call('get', `/users?search=${encodeURIComponent(demo.email)}`)
      .expect(200);
    const listed = (found.body as { items: { id: string; email: string }[] }).items.find(
      (item) => item.email === `${key}@${DEMO_EMAIL_DOMAIN}`,
    );
    if (!listed) {
      throw new Error(`El administrador no encontró a ${key}`);
    }
    const password = randomBytes(18).toString('hex');
    await this.admin.call('put', `/users/${listed.id}/password`).send({ password }).expect(204);

    const login = await request(serverOf(this.app))
      .post('/auth/login')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ email: demo.email, password })
      .expect(200);
    const cookies = cookiesFrom(login);
    this.secrets.push(password, cookies.access, cookies.refresh);
    const session = toSession(this.app, cookies, {
      key,
      id: listed.id,
      name: demo.name,
      role: demo.role,
    });

    // Coordinación participa en dos recorridos y la base persiste entre ellos: ya aceptó en el
    // primero. El control de R3 se hace la primera vez de cada usuario.
    if (!(await acceptedConsent(session))) {
      const blocked = await session.call('get', '/levels').expect(403);
      expect(apiErrorBodySchema.parse(blocked.body).code).toBe(ApiErrorCode.ConsentRequired);
      await acceptConsent(session);
    }
    await session.call('get', '/levels').expect(200);

    this.sessions.set(key, session);
    return session;
  }

  /** Todas las filas de la bitácora de un usuario, leídas por la API como coordinación. */
  async auditRowsOf(coordinator: DemoSession, userId: string): Promise<AuditLogEntry[]> {
    const rows: AuditLogEntry[] = [];
    let cursor: string | null = null;
    do {
      const query: string = `userId=${userId}&limit=100${cursor ? `&cursor=${cursor}` : ''}`;
      const res = await coordinator.call('get', `/audit-log?${query}`).expect(200);
      const page = res.body as AuditLogPage;
      rows.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return rows;
  }

  /** CSV de la bitácora de un usuario (la exportación deja además su propia fila). */
  async auditCsvOf(coordinator: DemoSession, userId: string): Promise<string> {
    const res = await coordinator.call('get', `/audit-log/export?userId=${userId}`).expect(200);
    return res.text;
  }

  /**
   * R7: nada de lo entregado (filas, detalles, CSV, errores) contiene los marcadores sembrados
   * ni las contraseñas, los valores de las cookies, las URL firmadas o las claves de objeto.
   */
  expectNoSensitiveData(delivered: string, markers: readonly string[]): void {
    for (const value of [...markers, ...this.secrets]) {
      expect(delivered).not.toContain(value);
    }
    expect(delivered).not.toMatch(/X-Amz-|formacion\/modulos\/|certificados\/[0-9a-f-]{36}/);
  }
}

function sessionCall(
  app: INestApplication,
  cookies: Cookies,
  method: Method,
  path: string,
): request.Test {
  return request(serverOf(app))
    [method](path)
    .set('Cookie', cookieHeader(cookies, 'access'))
    .set('Origin', ALLOWED_ORIGIN);
}

function toSession(
  app: INestApplication,
  cookies: Cookies,
  data: Omit<DemoSession, 'call'>,
): DemoSession {
  return { ...data, call: (method, path) => sessionCall(app, cookies, method, path) };
}

async function acceptedConsent(session: DemoSession): Promise<boolean> {
  const status = await session.call('get', '/consent').expect(200);
  return (status.body as { accepted: boolean }).accepted;
}

async function acceptConsent(session: DemoSession): Promise<void> {
  const status = await session.call('get', '/consent').expect(200);
  const { policyVersion } = status.body as { policyVersion: string };
  await session.call('post', '/consent').send({ policyVersion, items: ALL_BOXES }).expect(201);
}

export interface AssignmentIds {
  gradeId: string;
  areaId: string;
  periodId: string;
}

/** Ids de grado, área y periodo de una asignación del docente, buscados por nombre (como la UI). */
export async function findAssignment(
  teacher: DemoSession,
  gradeName: string,
  areaName: string,
  periodNumber: number,
): Promise<AssignmentIds> {
  const mine = (await teacher.call('get', '/me/assignments').expect(200)).body as MyAssignments;
  const grade = mine.grades.find((item) => item.grade.name === gradeName);
  const area = grade?.areas.find((item) => item.name === areaName);
  if (!grade || !area) {
    throw new Error(`${teacher.key} no tiene asignado ${areaName} en ${gradeName}`);
  }
  const periods = (await teacher.call('get', '/academic-periods?pageSize=100').expect(200))
    .body as {
    items: { id: string; schoolYear: string; number: number }[];
  };
  const period = periods.items.find(
    (item) => item.schoolYear === mine.schoolYear && item.number === periodNumber,
  );
  if (!period) {
    throw new Error(`No existe el periodo ${periodNumber} de ${mine.schoolYear}`);
  }
  return { gradeId: grade.grade.id, areaId: area.id, periodId: period.id };
}
