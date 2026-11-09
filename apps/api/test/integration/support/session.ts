import { randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATA_CONSENT_ITEMS, UserRole, UserStatus } from '@gns/shared';
import request from 'supertest';
import { CredentialsService } from '../../../src/modules/identidad/credentials/credentials.service';
import { PrismaService } from '../../../src/shared/database/prisma.service';

export const ACCESS_COOKIE = 'gns_access';
export const REFRESH_COOKIE = 'gns_refresh';

export const ALLOWED_ORIGIN = process.env.CORS_ORIGINS?.split(',')[0] ?? '';

export interface TestUser {
  id: string;
  email: string;
  /** Generada para esta ejecución: ninguna contraseña de prueba está escrita en el código. */
  password: string;
  role: UserRole;
}

/** Contraseña aleatoria que cumple la política (12 a 128 caracteres). */
export const randomPassword = (): string => randomBytes(12).toString('hex');

/** Crea un usuario con credencial directamente en la base (sin pasar por la API). */
export async function createTestUser(
  app: INestApplication,
  options: {
    role?: UserRole;
    status?: UserStatus;
    withPassword?: boolean;
    /** Acepta la versión vigente del aviso de datos (por defecto sí). */
    consent?: boolean;
  } = {},
): Promise<TestUser> {
  const prisma = app.get(PrismaService);
  const role = options.role ?? UserRole.Teacher;
  const email = `${randomUUID().slice(0, 12)}@sesion.test`;
  const user = await prisma.user.create({
    data: {
      fullName: `Usuario de prueba ${role}`,
      institutionalEmail: email,
      role,
      status: options.status ?? UserStatus.Active,
    },
  });
  if (options.consent ?? true) {
    await prisma.dataConsent.create({
      data: {
        userId: user.id,
        policyVersion: app.get(ConfigService).getOrThrow<string>('DATA_POLICY_VERSION'),
        acceptedAt: new Date(),
        checkedItems: [...DATA_CONSENT_ITEMS],
      },
    });
  }
  const password = randomPassword();
  if (options.withPassword ?? true) {
    await app.get(CredentialsService, { strict: false }).assign(user.id, password);
  }
  return { id: user.id, email, password, role };
}

export interface SetCookie {
  name: string;
  value: string;
  /** Atributos en minúsculas (`httponly`, `samesite=strict`, `path=/auth`, ...). */
  attributes: string[];
}

export function setCookiesOf(res: request.Response): SetCookie[] {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  const list = Array.isArray(header) ? header : header ? [header] : [];
  return list.map((line) => {
    const [pair = '', ...attributes] = line.split(';').map((part) => part.trim());
    const separator = pair.indexOf('=');
    return {
      name: pair.slice(0, separator),
      value: pair.slice(separator + 1),
      attributes: attributes.map((attribute) => attribute.toLowerCase()),
    };
  });
}

export function setCookieNamed(res: request.Response, name: string): SetCookie {
  const found = setCookiesOf(res).find((cookie) => cookie.name === name);
  if (!found) {
    throw new Error(`La respuesta no estableció la cookie ${name}`);
  }
  return found;
}

/** Cookies de una sesión, tal como las enviaría el navegador. */
export interface Cookies {
  access: string;
  refresh: string;
}

export function cookiesFrom(res: request.Response): Cookies {
  return {
    access: setCookieNamed(res, ACCESS_COOKIE).value,
    refresh: setCookieNamed(res, REFRESH_COOKIE).value,
  };
}

/** Valor de la cabecera `Cookie`; con `only` envía solo una de las dos. */
export function cookieHeader(cookies: Cookies, only?: 'access' | 'refresh'): string {
  const pairs: string[] = [];
  if (only !== 'refresh') pairs.push(`${ACCESS_COOKIE}=${cookies.access}`);
  if (only !== 'access') pairs.push(`${REFRESH_COOKIE}=${cookies.refresh}`);
  return pairs.join('; ');
}

export const serverOf = (app: INestApplication): Server => app.getHttpServer() as Server;

export function login(
  app: INestApplication,
  credentials: { email: string; password: string; rememberMe?: boolean },
): request.Test {
  return request(serverOf(app)).post('/auth/login').send(credentials);
}

/** Ingresa con éxito y devuelve las cookies de la sesión. */
export async function signIn(
  app: INestApplication,
  user: TestUser,
  rememberMe = false,
): Promise<Cookies> {
  const res = await login(app, { email: user.email, password: user.password, rememberMe }).expect(
    200,
  );
  return cookiesFrom(res);
}

/** Pide `path` con las cookies de la sesión. */
export function asUser(
  app: INestApplication,
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  cookies: Cookies,
  only?: 'access' | 'refresh',
): request.Test {
  return request(serverOf(app))[method](path).set('Cookie', cookieHeader(cookies, only));
}
