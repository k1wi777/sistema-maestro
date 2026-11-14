import { createRenewingFetch } from './renewing-fetch';

const BASE = 'http://localhost:3000';

type Handler = (request: Request) => Response | Promise<Response>;

function setup(handler: Handler) {
  const calls: { url: string; method: string; body: string }[] = [];
  const onSessionEnded = jest.fn();
  const renewingFetch = createRenewingFetch({
    baseUrl: BASE,
    onSessionEnded,
    fetch: async (request) => {
      calls.push({
        url: request.url.slice(BASE.length),
        method: request.method,
        body: await request.clone().text(),
      });
      return handler(request);
    },
  });
  return { calls, onSessionEnded, renewingFetch };
}

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const post = (path: string, body: unknown) =>
  new Request(`${BASE}${path}`, { method: 'POST', body: JSON.stringify(body) });

describe('createRenewingFetch', () => {
  it('no toca las respuestas que no son 401', async () => {
    const { renewingFetch, calls } = setup(() => json(403, { code: 'sin_permiso' }));
    const response = await renewingFetch(new Request(`${BASE}/users`));
    expect(response.status).toBe(403);
    expect(calls).toHaveLength(1);
  });

  it('renueva ante un 401 y repite la petición una sola vez con el cuerpo original', async () => {
    let protectedHits = 0;
    const { renewingFetch, calls, onSessionEnded } = setup((request) => {
      if (request.url.endsWith('/auth/refresh')) return json(200);
      protectedHits += 1;
      return protectedHits === 1 ? json(401) : json(201, { ok: true });
    });
    const response = await renewingFetch(post('/planning', { title: 'Mi planeación' }));
    expect(response.status).toBe(201);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST /planning',
      'POST /auth/refresh',
      'POST /planning',
    ]);
    expect(calls[2]?.body).toBe(JSON.stringify({ title: 'Mi planeación' }));
    expect(onSessionEnded).not.toHaveBeenCalled();
  });

  it('no hace un segundo intento si la petición repetida vuelve a dar 401', async () => {
    const { renewingFetch, calls } = setup((request) =>
      request.url.endsWith('/auth/refresh') ? json(200) : json(401),
    );
    const response = await renewingFetch(new Request(`${BASE}/users`));
    expect(response.status).toBe(401);
    expect(calls.map((c) => c.url)).toEqual(['/users', '/auth/refresh', '/users']);
  });

  it.each(['/auth/login', '/auth/refresh', '/auth/logout'])(
    'no renueva ante un 401 de %s',
    async (path) => {
      const { renewingFetch, calls, onSessionEnded } = setup(() => json(401));
      const response = await renewingFetch(post(`${path}?x=1`, {}));
      expect(response.status).toBe(401);
      expect(calls).toHaveLength(1);
      expect(onSessionEnded).not.toHaveBeenCalled();
    },
  );

  it('hace una sola renovación para varios 401 simultáneos', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const seen = new Set<string>();
    const { renewingFetch, calls } = setup(async (request) => {
      if (request.url.endsWith('/auth/refresh')) {
        await gate;
        return json(200);
      }
      if (!seen.has(request.url)) {
        seen.add(request.url);
        return json(401);
      }
      return json(200);
    });
    const pending = ['/a', '/b', '/c'].map((p) => renewingFetch(new Request(`${BASE}${p}`)));
    await new Promise((resolve) => setTimeout(resolve, 10));
    release();
    const responses = await Promise.all(pending);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(calls.filter((c) => c.url === '/auth/refresh')).toHaveLength(1);
  });

  it('permite una renovación nueva cuando la anterior terminó', async () => {
    let expired = true;
    const { renewingFetch, calls } = setup((request) => {
      if (request.url.endsWith('/auth/refresh')) {
        expired = false;
        return json(200);
      }
      return expired ? json(401) : json(200);
    });
    await renewingFetch(new Request(`${BASE}/a`));
    expired = true;
    await renewingFetch(new Request(`${BASE}/b`));
    expect(calls.filter((c) => c.url === '/auth/refresh')).toHaveLength(2);
  });

  it('si la renovación falla avisa una vez y devuelve el 401 original', async () => {
    const { renewingFetch, onSessionEnded } = setup(() => json(401, { code: 'no_autenticado' }));
    const responses = await Promise.all([
      renewingFetch(new Request(`${BASE}/a`)),
      renewingFetch(new Request(`${BASE}/b`)),
    ]);
    expect(responses.map((r) => r.status)).toEqual([401, 401]);
    expect(onSessionEnded).toHaveBeenCalledTimes(1);
  });

  it('un fallo de red al renovar también termina la sesión', async () => {
    const { renewingFetch, onSessionEnded } = setup((request) => {
      if (request.url.endsWith('/auth/refresh')) throw new TypeError('network');
      return json(401);
    });
    const response = await renewingFetch(new Request(`${BASE}/a`));
    expect(response.status).toBe(401);
    expect(onSessionEnded).toHaveBeenCalledTimes(1);
  });
});
