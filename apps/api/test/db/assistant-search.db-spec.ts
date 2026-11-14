import { expectSqlError, useTestDatabase } from './support/database';
import { insertRow, insertUser, type Row } from './support/fixtures';

const db = useTestDatabase();

const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';
const INSUFFICIENT_PRIVILEGE = '42501';
const APP_ROLE = 'app_gns';

async function lexemes(text: string): Promise<string[]> {
  const result = await db.client.query<{ lexeme: string }>(
    `SELECT lexeme FROM unnest(to_tsvector('gns_spanish', $1)) ORDER BY lexeme`,
    [text],
  );
  return result.rows.map((row) => row.lexeme);
}

async function hasPrivilege(table: string, privilege: string): Promise<boolean> {
  const result = await db.client.query<{ allowed: boolean }>(
    'SELECT has_table_privilege($1, $2, $3) AS allowed',
    [APP_ROLE, table, privilege],
  );
  return result.rows[0]?.allowed ?? false;
}

function insertUnanswered(values: Record<string, unknown> = {}): Promise<Row> {
  return insertRow(db.client, 'pregunta_sin_respuesta', {
    texto: 'Un texto de prueba',
    texto_normalizado: `un texto de prueba ${Math.random()}`,
    ...values,
  });
}

async function insertFaq(): Promise<string> {
  const faq = await insertRow(db.client, 'pregunta_frecuente', {
    categoria: 'Convivencia',
    pregunta: '¿Pregunta de prueba?',
    respuesta: 'Respuesta de prueba',
    activa: true,
  });
  return String(faq.id);
}

async function insertClosed(closer: string, values: Record<string, unknown> = {}): Promise<Row> {
  return insertUnanswered({
    texto: null,
    texto_normalizado: null,
    estado: 'descartada',
    cerrada_por: closer,
    cerrada_en: new Date(),
    ...values,
  });
}

describe('gns_spanish search configuration (R8)', () => {
  it('folds accents and case and derives the Spanish stems', async () => {
    expect(await lexemes('Llegó TÁRDE')).toEqual(['lleg', 'tard']);
    expect(await lexemes('llega tarde')).toEqual(await lexemes('LLEGÓ tárde'));
  });

  it('gives the same stem to the inflections the assistant relies on', async () => {
    for (const form of ['llega', 'llegó', 'llegada', 'llegan']) {
      expect(await lexemes(form)).toEqual(['lleg']);
    }
  });

  it('drops the Spanish stop words and treats ñ like the plain letter', async () => {
    expect(await lexemes('un niño llega tarde mucho')).toEqual(['lleg', 'nin', 'tard']);
    expect(await lexemes('UN NINO LLEGA TARDE MUCHO')).toEqual(['lleg', 'nin', 'tard']);
  });

  it('can be used by the application role', async () => {
    await db.client.query(`SET LOCAL ROLE ${APP_ROLE}`);

    expect(await lexemes('Un niño llegó tárde')).toEqual(['lleg', 'nin', 'tard']);

    await db.client.query('RESET ROLE');
  });
});

describe('pregunta_sin_respuesta (R13, R15, R16)', () => {
  it('accepts a pending question with its text and the defaults', async () => {
    const row = await insertUnanswered();

    expect(row).toMatchObject({ estado: 'pendiente', veces: 1, cerrada_por: null });
  });

  it('accepts the two ways of closing a question, without text', async () => {
    const closer = String((await insertUser(db.client)).id);
    const faq = await insertFaq();

    await insertClosed(closer, { estado: 'atendida', pregunta_frecuente_id: faq });
    await insertClosed(closer);
  });

  it.each([
    ['an unknown status', { estado: 'archivada' }],
    ['a zero count', { veces: 0 }],
    ['a pending question without text', { texto: null, texto_normalizado: null }],
    ['text without its normalized form', { texto_normalizado: null }],
    ['a closed question that keeps its text', { estado: 'descartada' }],
  ])('rejects %s', async (_name, change) => {
    const values = { texto: 'texto', texto_normalizado: 'texto', estado: 'pendiente', veces: 1 };
    const merged = { ...values, ...change };

    await expectSqlError(
      db.client,
      CHECK_VIOLATION,
      `INSERT INTO pregunta_sin_respuesta (texto, texto_normalizado, estado, veces)
       VALUES ($1, $2, $3, $4)`,
      [merged.texto, merged.texto_normalizado, merged.estado, merged.veces],
    );
  });

  it('rejects a pending question linked to a FAQ or with a closer', async () => {
    const closer = String((await insertUser(db.client)).id);
    const faq = await insertFaq();

    await expectSqlError(
      db.client,
      CHECK_VIOLATION,
      `INSERT INTO pregunta_sin_respuesta (texto, texto_normalizado, pregunta_frecuente_id)
       VALUES ('texto', 'texto', $1)`,
      [faq],
    );
    await expectSqlError(
      db.client,
      CHECK_VIOLATION,
      `INSERT INTO pregunta_sin_respuesta (texto, texto_normalizado, cerrada_por, cerrada_en)
       VALUES ('texto', 'texto', $1, now())`,
      [closer],
    );
  });

  it('rejects an attended question without its FAQ, and a closure without who and when', async () => {
    const closer = String((await insertUser(db.client)).id);

    await expectSqlError(
      db.client,
      CHECK_VIOLATION,
      `INSERT INTO pregunta_sin_respuesta (estado, cerrada_por, cerrada_en)
       VALUES ('atendida', $1, now())`,
      [closer],
    );
    await expectSqlError(
      db.client,
      CHECK_VIOLATION,
      `INSERT INTO pregunta_sin_respuesta (estado, cerrada_por) VALUES ('descartada', $1)`,
      [closer],
    );
  });

  it('allows a single pending question per normalized text', async () => {
    await insertUnanswered({ texto_normalizado: 'misma pregunta' });

    await expectSqlError(
      db.client,
      UNIQUE_VIOLATION,
      `INSERT INTO pregunta_sin_respuesta (texto, texto_normalizado)
       VALUES ('Misma pregunta', 'misma pregunta')`,
    );
  });

  it('lets closed questions and a new pending one coexist', async () => {
    const closer = String((await insertUser(db.client)).id);
    await insertClosed(closer);
    await insertClosed(closer);

    await insertUnanswered({ texto_normalizado: 'misma pregunta' });
  });
});

describe('ocurrencia_pregunta_sin_respuesta (R13, R19)', () => {
  it('stores who asked and when, and has no text column', async () => {
    const user = await insertUser(db.client);
    const group = await insertUnanswered();

    const occurrence = await insertRow(db.client, 'ocurrencia_pregunta_sin_respuesta', {
      pregunta_sin_respuesta_id: group.id,
      usuario_id: user.id,
    });

    expect(occurrence).toMatchObject({ usuario_id: user.id });
    expect(Object.keys(occurrence).sort()).toEqual([
      'actualizado_en',
      'creado_en',
      'id',
      'pregunta_sin_respuesta_id',
      'preguntado_en',
      'usuario_id',
    ]);
  });
});

describe(`${APP_ROLE} role on the unanswered questions (R7)`, () => {
  it('has no DELETE or TRUNCATE on either table', async () => {
    for (const table of ['pregunta_sin_respuesta', 'ocurrencia_pregunta_sin_respuesta']) {
      expect(await hasPrivilege(table, 'DELETE')).toBe(false);
      expect(await hasPrivilege(table, 'TRUNCATE')).toBe(false);
    }
  });

  it('can read, insert and update the groups but never modify an occurrence', async () => {
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE']) {
      expect(await hasPrivilege('pregunta_sin_respuesta', privilege)).toBe(true);
    }
    expect(await hasPrivilege('ocurrencia_pregunta_sin_respuesta', 'SELECT')).toBe(true);
    expect(await hasPrivilege('ocurrencia_pregunta_sin_respuesta', 'INSERT')).toBe(true);
    expect(await hasPrivilege('ocurrencia_pregunta_sin_respuesta', 'UPDATE')).toBe(false);
  });

  it('rejects a DELETE on either table made as the application', async () => {
    await db.client.query(`SET LOCAL ROLE ${APP_ROLE}`);

    for (const table of ['pregunta_sin_respuesta', 'ocurrencia_pregunta_sin_respuesta']) {
      await expectSqlError(db.client, INSUFFICIENT_PRIVILEGE, `DELETE FROM ${table}`);
    }
  });

  it('rejects an UPDATE of an occurrence made as the application', async () => {
    const user = await insertUser(db.client);
    const group = await insertUnanswered();
    await insertRow(db.client, 'ocurrencia_pregunta_sin_respuesta', {
      pregunta_sin_respuesta_id: group.id,
      usuario_id: user.id,
    });
    await db.client.query(`SET LOCAL ROLE ${APP_ROLE}`);

    await expectSqlError(
      db.client,
      INSUFFICIENT_PRIVILEGE,
      `UPDATE ocurrencia_pregunta_sin_respuesta SET preguntado_en = now()`,
    );
  });
});
