import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema, type ApiErrorBody } from '@gns/shared';
import request from 'supertest';
import { createTestApp } from './support/create-test-app';

describe('formato común de errores y respuestas', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer() as Server;

  /** Comprueba el formato común y el id de petición, y devuelve el cuerpo. */
  function expectApiError(res: request.Response, statusCode: number): ApiErrorBody {
    expect(res.status).toBe(statusCode);
    const body = apiErrorBodySchema.parse(res.body);
    expect(body.statusCode).toBe(statusCode);
    expect(body.requestId).toBe(res.headers['x-request-id']);
    return body;
  }

  it('responde 400 con el campo y el motivo de cada dato inválido del cuerpo', async () => {
    const res = await request(server()).post('/faq-example').send({ extra: 1 });
    const body = expectApiError(res, 400);
    expect(body.code).toBe('validacion');
    expect(body.errors).toEqual(
      expect.arrayContaining([
        { field: 'category', reason: 'es obligatorio' },
        { field: 'question', reason: 'es obligatorio' },
        { field: 'answer', reason: 'es obligatorio' },
        { field: 'extra', reason: 'parámetro desconocido' },
      ]),
    );
  });

  it('responde 400 con el campo de la query inválida', async () => {
    const res = await request(server()).get('/faq-example').query({ pageSize: '0', sortBy: 'x' });
    const body = expectApiError(res, 400);
    expect(body.errors?.map((error) => error.field).sort()).toEqual(['pageSize', 'sortBy']);
  });

  it('responde 400 con el parámetro de ruta que no es un UUID', async () => {
    const res = await request(server()).get('/faq-example/no-es-uuid');
    const body = expectApiError(res, 400);
    expect(body.errors).toEqual([{ field: 'id', reason: 'debe ser un UUID' }]);
  });

  it('responde 400 sin eco del texto cuando el JSON está mal formado', async () => {
    const res = await request(server())
      .post('/faq-example')
      .set('Content-Type', 'application/json')
      .send('{"question": "dato-privado", ');
    const body = expectApiError(res, 400);
    expect(body.code).toBe('validacion');
    expect(JSON.stringify(body)).not.toMatch(/dato-privado|JSON|Unexpected|position/i);
  });

  it('responde 404 en el formato común para una ruta inexistente', async () => {
    const body = expectApiError(await request(server()).get('/no-existe'), 404);
    expect(body.code).toBe('no_encontrado');
    expect(body.message).not.toMatch(/Cannot|Not Found/);
  });

  it('conserva el mensaje en español que escribe el servicio en un 404', async () => {
    const body = expectApiError(await request(server()).get(`/faq-example/${randomUUID()}`), 404);
    expect(body.message).toBe('Pregunta frecuente no encontrada');
  });

  it('responde 404 cuando se modifica un registro que no existe', async () => {
    const res = await request(server()).patch(`/faq-example/${randomUUID()}`).send({ answer: 'x' });
    expect(expectApiError(res, 404).code).toBe('no_encontrado');
  });

  it.each([
    ['unicidad', '/failures/unique', 409, 'conflicto'],
    ['llave foránea', '/failures/foreign-key', 409, 'conflicto'],
    ['CHECK', '/failures/check', 400, 'validacion'],
  ])(
    'traduce un error de base de datos por %s sin exponer detalles',
    async (_name, path, status, code) => {
      const body = expectApiError(await request(server()).get(path), status);
      expect(body.code).toBe(code);
      expect(body.errors).toBeUndefined();
      expect(JSON.stringify(body)).not.toMatch(
        /usuario|correo|rol-|pregunta|constraint|unique|violat|key|check|INSERT|SELECT|@unicidad|prisma/i,
      );
    },
  );

  it('responde 500 genérico sin detalles de un error no previsto', async () => {
    const body = expectApiError(await request(server()).get('/failures/boom'), 500);
    expect(body).toMatchObject({ code: 'error_interno', message: 'Ocurrió un error inesperado' });
    expect(JSON.stringify(body)).not.toMatch(/SELECT|usuario|detalle interno/);
  });

  it('devuelve el recurso sin envoltorio y sin los campos no declarados en el esquema', async () => {
    const res = await request(server()).get('/failures/undeclared').expect(200);
    const body = res.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      ['answer', 'category', 'createdAt', 'id', 'isActive', 'question'].sort(),
    );
  });
});
