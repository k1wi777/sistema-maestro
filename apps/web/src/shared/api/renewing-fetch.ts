export interface RenewingFetchOptions {
  fetch: (input: Request) => Promise<Response>;
  /** Dirección de la API sin barra final. */
  baseUrl: string;
  /** Se llama una vez por renovación fallida: la sesión terminó. */
  onSessionEnded: () => void;
}

/** Rutas que no se renuevan: un 401 aquí es una respuesta válida (credencial o sesión ya cerrada). */
const NEVER_RENEWED = new Set(['/auth/login', '/auth/refresh', '/auth/logout']);

function apiPath(url: string, baseUrl: string): string {
  const relative = url.startsWith(baseUrl) ? url.slice(baseUrl.length) : url;
  return relative.split('?')[0] ?? relative;
}

/**
 * `fetch` que renueva la sesión ante un 401: pide `POST /auth/refresh` y repite la petición
 * original una sola vez. Las peticiones que reciben 401 mientras hay una renovación en curso
 * esperan esa misma renovación. Cualquier otra respuesta pasa sin tocar.
 */
export function createRenewingFetch({
  fetch: send,
  baseUrl,
  onSessionEnded,
}: RenewingFetchOptions): (input: Request) => Promise<Response> {
  let renewal: Promise<boolean> | null = null;

  async function renewSession(): Promise<boolean> {
    try {
      const response = await send(
        new Request(`${baseUrl}/auth/refresh`, { method: 'POST', credentials: 'include' }),
      );
      if (response.ok) {
        return true;
      }
    } catch {
      // Un fallo de red al renovar equivale a una renovación fallida.
    }
    onSessionEnded();
    return false;
  }

  function renew(): Promise<boolean> {
    renewal ??= renewSession().finally(() => {
      renewal = null;
    });
    return renewal;
  }

  return async (request) => {
    // El cuerpo se consume al enviarlo: el clon permite repetir la petición tal cual.
    const retry = request.clone();
    const response = await send(request);
    if (response.status !== 401 || NEVER_RENEWED.has(apiPath(request.url, baseUrl))) {
      return response;
    }
    if (!(await renew())) {
      return response;
    }
    return send(retry);
  };
}
