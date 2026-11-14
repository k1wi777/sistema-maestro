import { randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  UserRole,
  type AssistantAnswer,
  type FaqAdminView,
  type FaqView,
  type Page,
  type UnansweredQuestion,
} from '@gns/shared';
import { FAQ_ENTRIES } from '../../prisma/seed/initial/faq.data';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { asUser, createTestUser, signIn, type Cookies, type TestUser } from './support/session';

/** Las filas de bitácora traen el id como BigInt, que JSON no serializa. */
const serialize = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    typeof item === 'bigint' ? item.toString() : item,
  );

/** Palabra inventada solo de letras: tiene un lexema significativo y no coincide con ninguna pregunta. */
const word = () =>
  Array.from(randomBytes(9))
    .map((byte) => String.fromCharCode(97 + (byte % 26)))
    .join('');

describe('asistente (BE-8)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let coordUser: TestUser;
  let coord: Cookies;
  let teacherA: TestUser;
  let teacher: Cookies;
  let teacherB: TestUser;
  let teacherBCookies: Cookies;

  const ask = (cookies: Cookies, question: string) =>
    asUser(app, 'post', '/assistant/queries', cookies).send({ question });
  const answerTo = async (cookies: Cookies, question: string) =>
    (await ask(cookies, question).expect(200)).body as AssistantAnswer;
  const assistantLogs = (userId: string) =>
    prisma.auditLog.findMany({ where: { userId, type: 'asistente' }, orderBy: { id: 'asc' } });
  const detail = async (id: string) =>
    (await asUser(app, 'get', `/unanswered-questions/${id}`, coord).expect(200))
      .body as UnansweredQuestion;
  /** Hace la misma pregunta sin respuesta desde dos docentes y devuelve el id del grupo. */
  const unansweredGroup = async (token: string): Promise<string> => {
    await answerTo(teacher, `¿Qué hago con ${token}?`);
    const group = await prisma.unansweredQuestion.findFirstOrThrow({
      where: { normalizedText: `que hago con ${token}` },
    });
    return group.id;
  };

  beforeAll(async () => {
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    coordUser = await createTestUser(app, { role: UserRole.Coordinator });
    coord = await signIn(app, coordUser);
    teacherA = await createTestUser(app);
    teacher = await signIn(app, teacherA);
    teacherB = await createTestUser(app);
    teacherBCookies = await signIn(app, teacherB);
    // La base de integración no tiene el seed: se cargan las 20 preguntas iniciales.
    await prisma.faqEntry.createMany({
      data: FAQ_ENTRIES.map((entry) => ({
        category: entry.category,
        question: entry.question,
        answer: entry.answer,
        keywords: entry.keywords,
        source: entry.source,
        isActive: true,
      })),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('lectura para cualquier rol (R1, R6)', () => {
    it('un docente ve las activas con solo categoría, pregunta, respuesta y fuente', async () => {
      const inactive = `Inactiva ${randomUUID()}`;
      await prisma.faqEntry.create({
        data: { category: 'Institucional', question: inactive, answer: 'x', isActive: false },
      });

      const res = await asUser(app, 'get', '/assistant/faqs', teacher).expect(200);
      const items = (res.body as { items: FaqView[] }).items;

      expect(items.length).toBeGreaterThanOrEqual(FAQ_ENTRIES.length);
      expect(items.map((item) => item.question)).not.toContain(inactive);
      for (const item of items) {
        expect(Object.keys(item).sort()).toEqual([
          'answer',
          'category',
          'id',
          'question',
          'source',
        ]);
      }
    });

    it('un docente no puede gestionar preguntas ni ver las sin respuesta', async () => {
      const faq = await prisma.faqEntry.findFirstOrThrow();
      const id = faq.id;
      const attempts = [
        asUser(app, 'get', '/faqs', teacher),
        asUser(app, 'get', `/faqs/${id}`, teacher),
        asUser(app, 'post', '/faqs', teacher).send({
          category: 'Convivencia',
          question: 'x',
          answer: 'y',
        }),
        asUser(app, 'patch', `/faqs/${id}`, teacher).send({ isActive: false }),
        asUser(app, 'get', '/unanswered-questions', teacher),
        asUser(app, 'get', `/unanswered-questions/${randomUUID()}`, teacher),
        asUser(app, 'post', `/unanswered-questions/${randomUUID()}/discard`, teacher),
      ];
      for (const attempt of attempts) {
        const res = await attempt.expect(403);
        expect((res.body as { code: string }).code).toBe('sin_permiso');
      }
    });

    it('coordinación también puede consultar el asistente', async () => {
      await asUser(app, 'get', '/assistant/faqs', coord).expect(200);
    });
  });

  describe('gestión de preguntas frecuentes (R2 a R5, R7, R17)', () => {
    const body = (question: string) => ({
      category: 'Uso de la plataforma',
      question,
      answer: 'Respuesta de prueba',
    });

    it('crea activa por defecto, edita parcialmente y desactiva y reactiva', async () => {
      const question = `Pregunta ${randomUUID()}`;
      const created = await asUser(app, 'post', '/faqs', coord).send(body(question)).expect(201);
      const faq = created.body as FaqAdminView;
      expect(faq).toMatchObject({
        question,
        isActive: true,
        updatedById: coordUser.id,
        keywords: null,
      });

      const edited = await asUser(app, 'patch', `/faqs/${faq.id}`, coord)
        .send({ answer: 'Otra respuesta', keywords: 'clave uno' })
        .expect(200);
      expect(edited.body).toMatchObject({
        question,
        answer: 'Otra respuesta',
        keywords: 'clave uno',
      });

      await asUser(app, 'patch', `/faqs/${faq.id}`, coord).send({ isActive: false }).expect(200);
      const hidden = (await asUser(app, 'get', '/assistant/faqs', teacher).expect(200)).body as {
        items: FaqView[];
      };
      expect(hidden.items.map((item) => item.question)).not.toContain(question);

      await asUser(app, 'patch', `/faqs/${faq.id}`, coord).send({ isActive: true }).expect(200);
      const shown = (await asUser(app, 'get', '/assistant/faqs', teacher).expect(200)).body as {
        items: FaqView[];
      };
      expect(shown.items.map((item) => item.question)).toContain(question);
    });

    it('lista paginado con inactivas y filtra por estado y categoría; lee por id', async () => {
      const question = `Inactiva ${randomUUID()}`;
      const faq = (
        await asUser(app, 'post', '/faqs', coord)
          .send({ ...body(question), category: 'Institucional', isActive: false })
          .expect(201)
      ).body as FaqAdminView;

      const res = await asUser(app, 'get', '/faqs', coord)
        .query({ isActive: 'false', category: 'Institucional', pageSize: '100' })
        .expect(200);
      const page = res.body as Page<FaqAdminView>;
      expect(page.items.map((item) => item.id)).toContain(faq.id);
      expect(page.items.every((item) => !item.isActive && item.category === 'Institucional')).toBe(
        true,
      );

      const one = await asUser(app, 'get', `/faqs/${faq.id}`, coord).expect(200);
      expect(one.body).toMatchObject({ id: faq.id, isActive: false });
      await asUser(app, 'get', `/faqs/${randomUUID()}`, coord).expect(404);
      await asUser(app, 'patch', `/faqs/${randomUUID()}`, coord)
        .send({ isActive: true })
        .expect(404);
    });

    it.each([
      ['una categoría desconocida', { category: 'Otra' }],
      ['una pregunta vacía', { question: '  ' }],
      ['una pregunta de más de 200 caracteres', { question: 'a'.repeat(201) }],
      ['una respuesta vacía', { answer: '' }],
      ['palabras clave de más de 500 caracteres', { keywords: 'a'.repeat(501) }],
      ['una fuente vacía', { source: '' }],
    ])('rechaza %s con 400 sin escribir nada', async (_name, change) => {
      const marker = `Rechazada ${randomUUID()}`;
      await asUser(app, 'post', '/faqs', coord)
        .send({ ...body(marker), ...change })
        .expect(400);

      expect(await prisma.faqEntry.count({ where: { question: marker } })).toBe(0);
    });

    it('rechaza editar sin campos con 400', async () => {
      const faq = await prisma.faqEntry.findFirstOrThrow({ where: { isActive: true } });
      await asUser(app, 'patch', `/faqs/${faq.id}`, coord).send({}).expect(400);
    });

    it('escribe la bitácora de crear y editar en la misma operación', async () => {
      const question = `Auditada ${randomUUID()}`;
      const faq = (await asUser(app, 'post', '/faqs', coord).send(body(question)).expect(201))
        .body as FaqAdminView;
      await asUser(app, 'patch', `/faqs/${faq.id}`, coord).send({ isActive: false }).expect(200);

      const rows = (await assistantLogs(coordUser.id)).filter((row) => row.entityId === faq.id);
      expect(rows.map((row) => row.action)).toEqual([
        'Creó una pregunta del asistente',
        'Editó una pregunta del asistente',
      ]);
      expect(
        rows.every((row) => row.entity === 'pregunta_frecuente' && row.role === 'coordinador'),
      ).toBe(true);
    });

    it('no ofrece ninguna ruta que borre', async () => {
      const faq = await prisma.faqEntry.findFirstOrThrow();
      await asUser(app, 'delete', `/faqs/${faq.id}`, coord).expect(404);
      await asUser(app, 'delete', `/unanswered-questions/${randomUUID()}`, coord).expect(404);
      expect(await prisma.faqEntry.count({ where: { id: faq.id } })).toBe(1);
    });
  });

  describe('búsqueda en español (R8 a R12)', () => {
    it.each(['un niño llega tarde mucho', 'UN NINO LLEGA TARDE MUCHO', 'Un niño llegó tárde'])(
      '«%s» responde con la pregunta de llegadas tarde',
      async (question) => {
        const answer = await answerTo(teacher, question);

        expect(answer.status).toBe('answered');
        if (answer.status === 'answered') {
          expect(answer.faq.question).toBe(FAQ_ENTRIES[0]?.question);
          expect(answer.faq.answer).toBe(FAQ_ENTRIES[0]?.answer);
          expect(answer.related.map((r) => r.id)).not.toContain(answer.faq.id);
          expect(answer.related.length).toBeLessThanOrEqual(3);
        }
      },
    );

    it('«¿qué hago con un estudiante?» no responde con la de llegadas tarde', async () => {
      const answer = await answerTo(teacher, '¿qué hago con un estudiante?');

      expect(answer.status).toBe('unanswered');
    });

    it('ofrece relacionadas con puntaje suficiente y sin repetir la respondida', async () => {
      const [a, b, c] = [word(), word(), word()];
      const make = (question: string) =>
        asUser(app, 'post', '/faqs', coord)
          .send({ category: 'Convivencia', question, answer: 'Respuesta de prueba' })
          .expect(201);
      const main = (await make(`${a} ${b} ${c}`)).body as FaqAdminView;
      const related = (await make(`${a} ${c} ${word()}`)).body as FaqAdminView;
      await make(`${word()} ${word()}`);

      const answer = await answerTo(teacher, `${a} ${b} ${c}`);

      expect(answer).toMatchObject({ status: 'answered', faq: { id: main.id } });
      if (answer.status === 'answered') {
        expect(answer.related.map((r) => r.id)).toEqual([related.id]);
      }
    });

    it('sugiere hasta 4 preguntas cuando ninguna alcanza el umbral y registra la pregunta', async () => {
      const answer = await answerTo(teacher, `¿Qué hacer con ${word()}?`);

      expect(answer.status).toBe('unanswered');
      if (answer.status === 'unanswered') {
        expect(answer.suggestions.length).toBeGreaterThan(0);
        expect(answer.suggestions.length).toBeLessThanOrEqual(4);
        expect(Object.keys(answer)).toEqual(['status', 'suggestions']);
      }
    });

    it('sin palabras significativas responde con sugerencias y no registra nada', async () => {
      const user = await createTestUser(app);
      const cookies = await signIn(app, user);

      const answer = await answerTo(cookies, 'hola');

      expect(answer.status).toBe('unanswered');
      expect(await prisma.unansweredQuestionOccurrence.count({ where: { userId: user.id } })).toBe(
        0,
      );
      const rows = await assistantLogs(user.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        action: 'Hizo una pregunta sin respuesta al asistente',
        entity: null,
        entityId: null,
      });
    });

    it.each([['a'], [' a '], ['a'.repeat(201)]])(
      'rechaza una consulta de %j caracteres con 400 sin registrar nada',
      async (question) => {
        const user = await createTestUser(app);
        const cookies = await signIn(app, user);

        await ask(cookies, question).expect(400);

        expect(await assistantLogs(user.id)).toHaveLength(0);
        expect(
          await prisma.unansweredQuestionOccurrence.count({ where: { userId: user.id } }),
        ).toBe(0);
      },
    );

    it('una consulta sin sesión responde 401', async () => {
      await asUser(app, 'post', '/assistant/queries', { access: '', refresh: '' })
        .send({ question: 'hola' })
        .expect(401);
    });
  });

  describe('preguntas sin respuesta (R13 a R19)', () => {
    it('agrupa por texto normalizado, suma una vez y registra el autor de cada ocurrencia', async () => {
      const token = word();
      await answerTo(teacher, `¿Qué hago con ${token}?`);
      await answerTo(teacherBCookies, `  QUÉ hago con ${token.toUpperCase()}!! `);
      await answerTo(teacher, `que hago con ${token}`);

      const groups = await prisma.unansweredQuestion.findMany({
        where: { normalizedText: `que hago con ${token}` },
      });
      expect(groups).toHaveLength(1);
      const group = groups[0] as (typeof groups)[number];
      // El texto mostrado es el de la primera persona.
      expect(group).toMatchObject({
        times: 3,
        status: 'pendiente',
        text: `¿Qué hago con ${token}?`,
      });
      expect(group.lastAskedAt.getTime()).toBeGreaterThanOrEqual(group.firstAskedAt.getTime());

      const view = await detail(group.id);
      expect(view.occurrences.map((o) => o.user.id)).toEqual(
        [teacherA.id, teacherB.id, teacherA.id].reverse(),
      );
      expect(view.occurrences.every((o) => Object.keys(o.user).sort().join() === 'id,name')).toBe(
        true,
      );
      expect(view.occurrences.map((o) => o.askedAt)).toEqual(
        [...view.occurrences.map((o) => o.askedAt)].sort().reverse(),
      );
    });

    it('lista paginado solo las pendientes, con texto, veces, fechas y las ocurrencias recientes', async () => {
      const token = word();
      const id = await unansweredGroup(token);

      const res = await asUser(app, 'get', '/unanswered-questions', coord)
        .query({ pageSize: '100' })
        .expect(200);
      const page = res.body as Page<UnansweredQuestion>;
      const found = page.items.find((item) => item.id === id);

      expect(found).toMatchObject({
        text: `¿Qué hago con ${token}?`,
        times: 1,
        status: 'pendiente',
        faqId: null,
      });
      expect(found?.occurrences).toHaveLength(1);
      expect(found?.occurrences[0]?.user).toEqual({
        id: teacherA.id,
        name: expect.any(String) as string,
      });
      expect(page.items.every((item) => item.status === 'pendiente')).toBe(true);
      const times = page.items.map((item) => item.times);
      expect(times).toEqual([...times].sort((x, y) => y - x));
    });

    it('trae como máximo 10 ocurrencias por grupo en el listado y todas en el detalle', async () => {
      const token = word();
      const id = await unansweredGroup(token);
      const rows = Array.from({ length: 11 }, () => ({
        unansweredQuestionId: id,
        userId: teacherB.id,
      }));
      await prisma.unansweredQuestionOccurrence.createMany({ data: rows });
      await prisma.unansweredQuestion.update({ where: { id }, data: { times: 12 } });

      const page = (
        await asUser(app, 'get', '/unanswered-questions', coord)
          .query({ pageSize: '100' })
          .expect(200)
      ).body as Page<UnansweredQuestion>;

      expect(page.items.find((item) => item.id === id)?.occurrences).toHaveLength(10);
      expect((await detail(id)).occurrences).toHaveLength(12);
    });

    it('responde 404 al detalle de una pregunta que no existe y 400 a un id inválido', async () => {
      await asUser(app, 'get', `/unanswered-questions/${randomUUID()}`, coord).expect(404);
      await asUser(app, 'get', '/unanswered-questions/no-uuid', coord).expect(400);
    });

    it('al crear una pregunta frecuente desde una sin respuesta la atiende, la enlaza y retira el texto', async () => {
      const token = word();
      const id = await unansweredGroup(token);
      await answerTo(teacherBCookies, `¿Qué hago con ${token}?`);

      const created = await asUser(app, 'post', '/faqs', coord)
        .send({
          category: 'Convivencia',
          question: `Respuesta a ${token}`,
          answer: 'Una respuesta',
          unansweredQuestionId: id,
        })
        .expect(201);
      const faq = created.body as FaqAdminView;

      const view = await detail(id);
      expect(view).toMatchObject({ status: 'atendida', faqId: faq.id, text: null, times: 2 });
      expect(view.closedAt).not.toBeNull();
      expect(view.occurrences.map((o) => o.user.id).sort()).toEqual(
        [teacherA.id, teacherB.id].sort(),
      );
      const row = await prisma.unansweredQuestion.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ text: null, normalizedText: null, closedById: coordUser.id });

      const pending = (
        await asUser(app, 'get', '/unanswered-questions', coord)
          .query({ pageSize: '100' })
          .expect(200)
      ).body as Page<UnansweredQuestion>;
      expect(pending.items.map((item) => item.id)).not.toContain(id);
      const attended = (
        await asUser(app, 'get', '/unanswered-questions', coord)
          .query({ status: 'atendida', pageSize: '100' })
          .expect(200)
      ).body as Page<UnansweredQuestion>;
      expect(attended.items.map((item) => item.id)).toContain(id);
    });

    it('no crea nada si la pregunta sin respuesta no existe (404) o ya está cerrada (409)', async () => {
      const token = word();
      const id = await unansweredGroup(token);
      const post = (question: string, unansweredQuestionId: string) =>
        asUser(app, 'post', '/faqs', coord).send({
          category: 'Convivencia',
          question,
          answer: 'Una respuesta',
          unansweredQuestionId,
        });
      const first = `Primera ${token}`;
      await post(first, id).expect(201);

      const missing = `Inexistente ${token}`;
      await post(missing, randomUUID()).expect(404);
      const closed = `Cerrada ${token}`;
      const res = await post(closed, id).expect(409);

      expect((res.body as { code: string }).code).toBe('pregunta_sin_respuesta_cerrada');
      expect(await prisma.faqEntry.count({ where: { question: missing } })).toBe(0);
      expect(await prisma.faqEntry.count({ where: { question: closed } })).toBe(0);
      expect(await prisma.faqEntry.count({ where: { question: first } })).toBe(1);
    });

    it('descarta una pendiente, retira el texto y responde 409 si ya está cerrada', async () => {
      const token = word();
      const id = await unansweredGroup(token);

      const res = await asUser(app, 'post', `/unanswered-questions/${id}/discard`, coord).expect(
        200,
      );

      expect(res.body).toMatchObject({ id, status: 'descartada', text: null, faqId: null });
      expect((res.body as UnansweredQuestion).occurrences).toHaveLength(1);
      const again = await asUser(app, 'post', `/unanswered-questions/${id}/discard`, coord).expect(
        409,
      );
      expect((again.body as { code: string }).code).toBe('pregunta_sin_respuesta_cerrada');
      await asUser(app, 'post', `/unanswered-questions/${randomUUID()}/discard`, coord).expect(404);
    });

    it('una pregunta igual a una cerrada abre un grupo nuevo', async () => {
      const token = word();
      const id = await unansweredGroup(token);
      await asUser(app, 'post', `/unanswered-questions/${id}/discard`, coord).expect(200);

      const newId = await unansweredGroup(token);

      expect(newId).not.toBe(id);
      expect(await detail(newId)).toMatchObject({ status: 'pendiente', times: 1 });
    });
  });

  describe('bitácora (R17, R18)', () => {
    it('registra cada consulta sin el texto escrito, con el id respondido o el del grupo', async () => {
      const user = await createTestUser(app);
      const cookies = await signIn(app, user);
      const token = word();

      const answered = await answerTo(cookies, 'un niño llega tarde mucho');
      await answerTo(cookies, `¿Qué hago con ${token}?`);

      const rows = await assistantLogs(user.id);
      expect(rows).toHaveLength(2);
      const group = await prisma.unansweredQuestion.findFirstOrThrow({
        where: { normalizedText: `que hago con ${token}` },
      });
      expect(rows[0]).toMatchObject({
        action: 'Consultó el asistente',
        entity: 'pregunta_frecuente',
        entityId: answered.status === 'answered' ? answered.faq.id : null,
        role: 'docente',
      });
      expect(rows[1]).toMatchObject({
        action: 'Hizo una pregunta sin respuesta al asistente',
        entity: 'pregunta_sin_respuesta',
        entityId: group.id,
      });
      const serialized = serialize(rows);
      expect(serialized).not.toContain(token);
      expect(serialized.toLowerCase()).not.toContain('llega tarde');
    });

    it('descartar escribe una fila de bitácora sin el texto de la pregunta', async () => {
      const token = word();
      const id = await unansweredGroup(token);
      await asUser(app, 'post', `/unanswered-questions/${id}/discard`, coord).expect(200);

      const rows = (await assistantLogs(coordUser.id)).filter((row) => row.entityId === id);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        action: 'Descartó una pregunta sin respuesta',
        entity: 'pregunta_sin_respuesta',
        role: 'coordinador',
      });
      expect(serialize(rows)).not.toContain(token);
      expect(rows[0]?.dataBefore).toMatchObject({ text: '[oculto]', status: 'pendiente' });
    });

    it('atender desde una pregunta frecuente deja la fila de la pregunta, sin el texto de la sin respuesta', async () => {
      const token = word();
      const id = await unansweredGroup(token);
      const faq = (
        await asUser(app, 'post', '/faqs', coord)
          .send({
            category: 'Convivencia',
            question: `Atendida ${randomUUID()}`,
            answer: 'Una respuesta',
            unansweredQuestionId: id,
          })
          .expect(201)
      ).body as FaqAdminView;

      const rows = (await assistantLogs(coordUser.id)).filter((row) => row.entityId === faq.id);

      expect(rows.map((row) => row.action)).toEqual(['Creó una pregunta del asistente']);
      expect(serialize(rows)).not.toContain(token);
    });
  });
});
