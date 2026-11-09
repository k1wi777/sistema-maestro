import type { IssuedSession } from './auth.service';

export const ACCESS_COOKIE = 'gns_access';
export const REFRESH_COOKIE = 'gns_refresh';

// El token de renovación solo viaja a /auth/*: así queda menos expuesto.
const ACCESS_COOKIE_PATH = '/';
const REFRESH_COOKIE_PATH = '/auth';

export interface CookieSettings {
  secure: boolean;
  accessTtlMinutes: number;
}

interface CookieOptions {
  httpOnly: true;
  sameSite: 'strict';
  secure: boolean;
  path: string;
  maxAge?: number;
}

/** Lo que el controlador necesita de la respuesta de Express. */
export interface CookieResponse {
  cookie(name: string, value: string, options: CookieOptions): unknown;
  clearCookie(name: string, options: Omit<CookieOptions, 'maxAge'>): unknown;
}

/** Lo que el guard y el controlador necesitan de la petición. */
export interface CookieRequest {
  cookies?: Record<string, unknown>;
}

export function readCookie(request: CookieRequest, name: string): string | undefined {
  const value = request.cookies?.[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

const base = (secure: boolean, path: string) =>
  ({ httpOnly: true, sameSite: 'strict', secure, path }) as const;

/**
 * Emite ambas cookies. Sin `expiresAt` (no se marcó «mantener la sesión iniciada») son
 * cookies de sesión del navegador, sin `Max-Age` ni `Expires`; con él son persistentes: la
 * de renovación dura hasta el máximo absoluto y la de acceso lo que dura el token.
 */
export function setSessionCookies(
  response: CookieResponse,
  issued: IssuedSession,
  settings: CookieSettings,
  now: Date = new Date(),
): void {
  const persistent = issued.expiresAt !== null;
  const accessMaxAge = persistent ? settings.accessTtlMinutes * 60 * 1000 : undefined;
  const refreshMaxAge = issued.expiresAt
    ? Math.max(0, issued.expiresAt.getTime() - now.getTime())
    : undefined;
  response.cookie(ACCESS_COOKIE, issued.accessToken, {
    ...base(settings.secure, ACCESS_COOKIE_PATH),
    ...(accessMaxAge === undefined ? {} : { maxAge: accessMaxAge }),
  });
  response.cookie(REFRESH_COOKIE, issued.refreshToken, {
    ...base(settings.secure, REFRESH_COOKIE_PATH),
    ...(refreshMaxAge === undefined ? {} : { maxAge: refreshMaxAge }),
  });
}

export function clearSessionCookies(response: CookieResponse, secure: boolean): void {
  response.clearCookie(ACCESS_COOKIE, base(secure, ACCESS_COOKIE_PATH));
  response.clearCookie(REFRESH_COOKIE, base(secure, REFRESH_COOKIE_PATH));
}
