import { SetMetadata, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const LOGIN_THROTTLE_KEY = 'gns:login-throttle';
export const LOGIN_THROTTLER_NAME = 'login';

/** Marca el endpoint de ingreso: es el único al que se aplica el límite de intentos de ingreso. */
export const LoginThrottled = () => SetMetadata(LOGIN_THROTTLE_KEY, true);

const reflector = new Reflector();

/** `skipIf` del throttler `login`: se omite en toda ruta sin la marca. */
export function skipUnlessLogin(context: ExecutionContext): boolean {
  return !reflector.get<boolean | undefined>(LOGIN_THROTTLE_KEY, context.getHandler());
}

interface LoginRequest {
  ip?: string;
  body?: { email?: unknown };
}

/**
 * Cuenta por la combinación de IP y correo, y no solo por IP: todo el colegio puede
 * salir por la misma IP (NAT). El correo se normaliza igual que en el ingreso.
 */
export function loginTracker(request: LoginRequest): string {
  const email = typeof request.body?.email === 'string' ? request.body.email : '';
  return `${request.ip ?? 'sin-ip'}|${email.trim().toLowerCase()}`;
}
