import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { FaqExampleModule } from './example/faq-example.module';

interface PageBody {
  items: { id: string; question: string; category: string; isActive: boolean }[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

describe('listados paginados (módulo de ejemplo)', () => {
  // Categoría propia del archivo: los datos no chocan con otras pruebas en paralelo.
  const category = `int-${randomUUID()}`;
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule, FaqExampleModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    // 25 filas; las preguntas se repiten de a pares para probar el desempate.
    await prisma.faqEntry.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        category,
        question: `Pregunta ${String(Math.floor(i / 2)).padStart(2, '0')}`,
        answer: 'Respuesta',
        isActive: i % 5 !== 0,
      })),
    });
  });

  afterAll(async () => {
    await prisma.faqEntry.deleteMany({ where: { category } });
    await app.close();
  });

  // getHttpServer() devuelve any: se tipa aquí una sola vez.
  const server = () => app.getHttpServer() as Server;
  const list = (query: Record<string, string>) =>
    request(server())
      .get('/faq-example')
      .query({ category, ...query });

  it('devuelve la página con sus totales', async () => {
    const res = await list({ page: '2', pageSize: '10' }).expect(200);
    const body = res.body as PageBody;
    expect(body).toMatchObject({ page: 2, pageSize: 10, totalItems: 25, totalPages: 3 });
    expect(body.items).toHaveLength(10);
  });

  it('usa página 1 y tamaño 20 por defecto', async () => {
    const body = (await list({}).expect(200)).body as PageBody;
    expect(body).toMatchObject({ page: 1, pageSize: 20, totalItems: 25, totalPages: 2 });
    expect(body.items).toHaveLength(20);
  });

  it('filtra por un booleano', async () => {
    const body = (await list({ isActive: 'false' }).expect(200)).body as PageBody;
    expect(body.totalItems).toBe(5);
    expect(body.items.every((item) => !item.isActive)).toBe(true);
  });

  it('ordena por pregunta descendente', async () => {
    const body = (await list({ sortBy: 'question', sortOrder: 'desc', pageSize: '5' }).expect(200))
      .body as PageBody;
    const questions = body.items.map((item) => item.question);
    expect(questions).toEqual([...questions].sort().reverse());
    expect(questions[0]).toBe('Pregunta 12');
  });

  it('recorre todas las páginas sin repetir ni omitir filas aunque el orden tenga empates', async () => {
    const seen: string[] = [];
    for (let page = 1; page <= 7; page++) {
      const body = (
        await list({ sortBy: 'question', pageSize: '4', page: String(page) }).expect(200)
      ).body as PageBody;
      seen.push(...body.items.map((item) => item.id));
    }
    expect(seen).toHaveLength(25);
    expect(new Set(seen).size).toBe(25);
  });

  it('responde vacío con los totales reales tras la última página', async () => {
    const body = (await list({ page: '99' }).expect(200)).body as PageBody;
    expect(body.items).toEqual([]);
    expect(body).toMatchObject({ page: 99, totalItems: 25, totalPages: 2 });
  });

  it('busca por id y responde 404 si no existe', async () => {
    const first = (await list({ pageSize: '1' }).expect(200)).body as PageBody;
    const id = first.items[0]?.id ?? '';
    await request(server()).get(`/faq-example/${id}`).expect(200);
    await request(server()).get(`/faq-example/${randomUUID()}`).expect(404);
  });

  it.each([
    ['parámetro desconocido', { extra: '1' }, 'extra'],
    ['sortBy no permitido', { sortBy: 'answer' }, 'sortBy'],
  ])('responde 400 con %s', async (_name, query, param) => {
    const res = await list(query).expect(400);
    expect(JSON.stringify(res.body)).toContain(param);
  });
});
