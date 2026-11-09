const ALLOWED_ENVIRONMENTS = ['development', 'test'];
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Parámetros de la URL con los que el cliente de PostgreSQL sustituye el host
 * real: una URL «local» con `?host=` apuntaría a otro servidor.
 */
const HOST_OVERRIDES = ['host', 'hostaddr'];

export interface DemoEnvironment {
  NODE_ENV?: string | undefined;
  DATABASE_URL?: string | undefined;
}

/**
 * Barrera previa a cualquier conexión: los datos demo solo se cargan o se
 * borran en desarrollo o pruebas y sobre una base local. Es una función pura:
 * el rechazo dice qué barrera falló sin mostrar la URL (puede tener contraseña).
 */
export function assertDemoAllowed(env: DemoEnvironment): void {
  if (!env.NODE_ENV || !ALLOWED_ENVIRONMENTS.includes(env.NODE_ENV)) {
    throw new Error(
      `Los datos demo solo se gestionan con NODE_ENV=${ALLOWED_ENVIRONMENTS.join(' o ')}. Operación rechazada.`,
    );
  }

  let url: URL | undefined;
  try {
    url = env.DATABASE_URL ? new URL(env.DATABASE_URL) : undefined;
  } catch {
    url = undefined;
  }
  if (!url) {
    throw new Error('DATABASE_URL falta o no es una URL válida. Operación rechazada.');
  }
  const overridesHost = HOST_OVERRIDES.some((name) => url.searchParams.has(name));
  if (overridesHost || !LOCAL_HOSTS.includes(url.hostname)) {
    throw new Error(
      'Los datos demo solo se gestionan sobre una base de datos local (localhost, 127.0.0.1 o ::1). Operación rechazada.',
    );
  }
}
