import { AreaType, TrainingModuleStatus, UserRole, UserStatus } from '@gns/shared';
import type { Client } from 'pg';
import { parseAdminConfig } from '../../prisma/seed/initial/admin-config.ts';
import { BENEFITS_ACTIVITIES } from '../../prisma/seed/initial/benefits.data.ts';
import {
  ACADEMIC_PERIOD_NUMBERS,
  AREAS,
  GRADES,
  LEVELS,
  SCHOOL_YEAR,
} from '../../prisma/seed/initial/catalogs.data.ts';
import { FAQ_ENTRIES } from '../../prisma/seed/initial/faq.data.ts';
import { GENERAL_PLAN_NAME, INDUCTION_MODULES } from '../../prisma/seed/initial/induction.data.ts';
import { seedInitialData } from '../../prisma/seed/initial/seed-initial.ts';
import { useTestDatabase } from './support/database';

const db = useTestDatabase();

const ADMIN = { name: 'Administrador de Prueba', email: 'seed-admin-prueba@gns.test' };

const SEEDED_TABLES = [
  'nivel',
  'grado',
  'area',
  'periodo_academico',
  'plan_formacion',
  'modulo_formacion',
  'diapositiva',
  'pregunta_desafio',
  'opcion_pregunta',
  'actividad_modulo',
  'pregunta_frecuente',
  'usuario',
];

type Row = Record<string, unknown>;

async function rows(sql: string, params: unknown[] = []): Promise<Row[]> {
  return (await db.client.query<Row>(sql, params)).rows;
}

async function tableCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of SEEDED_TABLES) {
    const result = await db.client.query<{ count: string }>(`SELECT count(*) FROM ${table}`);
    counts[table] = Number(result.rows[0]?.count);
  }
  return counts;
}

/** Cliente que anota cada consulta y puede fallar en una concreta. */
function spyClient(failOn?: string): { client: Client; queries: string[] } {
  const queries: string[] = [];
  const client = {
    query: (sql: string, params?: unknown[]) => {
      queries.push(sql);
      if (failOn && sql.includes(failOn)) {
        return Promise.reject(new Error('Fallo simulado'));
      }
      return db.client.query(sql, params);
    },
  } as unknown as Client;
  return { client, queries };
}

beforeEach(async () => {
  await seedInitialData(db.client, ADMIN);
});

describe('initial data content', () => {
  it('has the levels and grades in prototype order', async () => {
    const levels = await rows(
      `SELECT nombre, orden FROM nivel WHERE nombre = ANY($1) ORDER BY orden`,
      [LEVELS.map((level) => level.name)],
    );
    const grades = await rows(
      `SELECT g.nombre, g.orden, n.nombre AS nivel FROM grado g JOIN nivel n ON n.id = g.nivel_id
       WHERE g.nombre = ANY($1) ORDER BY g.orden`,
      [GRADES.map((grade) => grade.name)],
    );

    expect(levels).toEqual(LEVELS.map((level) => ({ nombre: level.name, orden: level.sortOrder })));
    expect(grades).toEqual(
      GRADES.map((grade) => ({
        nombre: grade.name,
        orden: grade.sortOrder,
        nivel: grade.levelName,
      })),
    );
    expect(LEVELS).toHaveLength(4);
    expect(GRADES).toHaveLength(18);
    expect(GRADES[0]?.name).toBe('Red');
    expect(GRADES.at(-1)?.name).toBe('11°');
  });

  it('has the 9 dimensions and 21 subjects', async () => {
    const result = await rows(`SELECT nombre, tipo FROM area WHERE nombre = ANY($1)`, [
      AREAS.map((area) => area.name),
    ]);
    const byName = new Map(result.map((row) => [row.nombre, row.tipo]));

    expect(AREAS.filter((area) => area.type === AreaType.Dimension)).toHaveLength(9);
    expect(AREAS.filter((area) => area.type === AreaType.Subject)).toHaveLength(21);
    for (const area of AREAS) {
      expect(byName.get(area.name)).toBe(area.type);
    }
  });

  it('has periods 1 to 3 of the school year without dates', async () => {
    const periods = await rows(
      `SELECT numero, fecha_inicio, fecha_fin FROM periodo_academico WHERE anio_lectivo = $1 ORDER BY numero`,
      [SCHOOL_YEAR],
    );

    expect(periods).toEqual(
      ACADEMIC_PERIOD_NUMBERS.map((numero) => ({ numero, fecha_inicio: null, fecha_fin: null })),
    );
  });

  it('has a single General plan with the 9 induction modules', async () => {
    const plans = await rows(
      `SELECT id, nombre FROM plan_formacion WHERE area_id IS NULL AND anio_lectivo = $1`,
      [SCHOOL_YEAR],
    );
    expect(plans).toHaveLength(1);
    expect(plans[0]?.nombre).toBe(GENERAL_PLAN_NAME);

    const modules = await rows(
      `SELECT numero, parte, orden, titulo, resumen, video_url, presentacion_url, estado
       FROM modulo_formacion WHERE plan_id = $1 ORDER BY orden`,
      [plans[0]?.id],
    );

    expect(modules).toEqual(
      INDUCTION_MODULES.map((module) => ({
        numero: module.number,
        parte: module.part,
        orden: module.sortOrder,
        titulo: module.title,
        resumen: module.summary,
        video_url: module.videoUrl,
        presentacion_url: null,
        estado: TrainingModuleStatus.Active,
      })),
    );
    expect(INDUCTION_MODULES.map((module) => module.number)).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
    ]);
  });

  it('has the text slides of modules 1 to 6 and none for modules 0, 7 and 8', async () => {
    const result = await rows(
      `SELECT m.numero, d.orden, d.titulo, d.ideas_clave
       FROM diapositiva d JOIN modulo_formacion m ON m.id = d.modulo_id
       JOIN plan_formacion p ON p.id = m.plan_id
       WHERE p.area_id IS NULL AND p.anio_lectivo = $1 ORDER BY m.orden, d.orden`,
      [SCHOOL_YEAR],
    );

    expect(result).toEqual(
      INDUCTION_MODULES.flatMap((module) =>
        module.slides.map((slide, index) => ({
          numero: module.number,
          orden: index + 1,
          titulo: slide.title,
          ideas_clave: slide.keyIdeas.join('\n'),
        })),
      ),
    );
    expect(result).toHaveLength(30);
    expect(result.some((row) => ['0', '7', '8'].includes(String(row.numero)))).toBe(false);
  });

  it('has the challenge questions with a single correct option and none in module 8', async () => {
    const questions = await rows(
      `SELECT m.numero, q.orden, q.tipo, q.enunciado, q.retroalimentacion, q.respuesta_vf,
              COALESCE(json_agg(json_build_object('texto', o.texto, 'es_correcta', o.es_correcta,
                'orden_correcto', o.orden_correcto) ORDER BY o.orden_correcto NULLS FIRST, o.creado_en, o.texto)
                FILTER (WHERE o.id IS NOT NULL), '[]') AS opciones
       FROM pregunta_desafio q JOIN modulo_formacion m ON m.id = q.modulo_id
       JOIN plan_formacion p ON p.id = m.plan_id
       LEFT JOIN opcion_pregunta o ON o.pregunta_id = q.id
       WHERE p.area_id IS NULL AND p.anio_lectivo = $1
       GROUP BY m.numero, m.orden, q.id ORDER BY m.orden, q.orden`,
      [SCHOOL_YEAR],
    );

    expect(questions).toHaveLength(45);
    const expected = INDUCTION_MODULES.flatMap((module) =>
      module.questions.map((question, index) => ({ module, question, index })),
    );
    expect(questions.map((row) => [row.numero, row.orden, row.tipo, row.enunciado])).toEqual(
      expected.map(({ module, question, index }) => [
        module.number,
        index + 1,
        question.type,
        question.prompt,
      ]),
    );
    questions.forEach((row, position) => {
      const { question } = expected[position] ?? {};
      const options = row.opciones as {
        texto: string;
        es_correcta: boolean | null;
        orden_correcto: number | null;
      }[];
      expect(row.retroalimentacion).toBe(question?.feedback);
      expect(row.respuesta_vf).toBe(question?.trueFalseAnswer ?? null);
      expect(options).toHaveLength(question?.options?.length ?? 0);
      if (question?.type === 'opcion') {
        expect(options.filter((option) => option.es_correcta === true)).toHaveLength(1);
        expect(options.every((option) => option.orden_correcto === null)).toBe(true);
      }
      if (question?.type === 'orden') {
        expect(options.map((option) => option.orden_correcto)).toEqual(
          options.map((_, index) => index + 1),
        );
        expect(options.map((option) => option.texto)).toEqual(
          question.options?.map((option) => option.text),
        );
      }
    });
    expect(questions.some((row) => row.numero === '8')).toBe(false);
  });

  it('has the module 8 activities in order with their required flag', async () => {
    const activities = await rows(
      `SELECT a.tipo, a.orden, a.titulo, a.obligatoria, a.estado
       FROM actividad_modulo a JOIN modulo_formacion m ON m.id = a.modulo_id
       JOIN plan_formacion p ON p.id = m.plan_id
       WHERE p.area_id IS NULL AND p.anio_lectivo = $1 AND m.numero = '8' ORDER BY a.orden`,
      [SCHOOL_YEAR],
    );

    expect(activities).toEqual(
      BENEFITS_ACTIVITIES.map((activity, index) => ({
        tipo: activity.type,
        orden: index + 1,
        titulo: activity.title,
        obligatoria: activity.isRequired,
        estado: TrainingModuleStatus.Active,
      })),
    );
    expect(activities.filter((activity) => activity.obligatoria).map((a) => a.titulo)).toEqual([
      'Conecta',
      '¿Verdad o mito?',
    ]);
  });

  it('keeps the salary of the simulators out of persistence', async () => {
    const simulators = await rows(
      `SELECT configuracion FROM actividad_modulo WHERE tipo = 'simulador' AND titulo LIKE 'Simulador de ahorro%'`,
    );

    const inputs = (simulators[0]?.configuracion as { entradas: Row[] }).entradas;
    expect(inputs.find((input) => input.clave === 'salario')?.solo_en_pantalla).toBe(true);
  });

  it('has the 20 assistant questions active', async () => {
    const faq = await rows(
      `SELECT categoria, pregunta, respuesta, palabras_clave, fuente, activa
       FROM pregunta_frecuente WHERE pregunta = ANY($1) ORDER BY pregunta`,
      [FAQ_ENTRIES.map((entry) => entry.question)],
    );

    expect(FAQ_ENTRIES).toHaveLength(20);
    expect(faq).toHaveLength(20);
    expect(faq.every((row) => row.activa === true)).toBe(true);
    for (const entry of FAQ_ENTRIES) {
      expect(faq).toContainEqual({
        categoria: entry.category,
        pregunta: entry.question,
        respuesta: entry.answer,
        palabras_clave: entry.keywords,
        fuente: entry.source,
        activa: true,
      });
    }
  });

  it('creates the first administrator from the configuration', async () => {
    const admin = await rows(
      `SELECT nombre_completo, rol, estado FROM usuario WHERE correo_institucional = $1`,
      [ADMIN.email],
    );

    expect(admin).toEqual([
      { nombre_completo: ADMIN.name, rol: UserRole.Administrator, estado: UserStatus.Active },
    ]);
  });
});

describe('seedInitialData idempotence', () => {
  it('inserts nothing and changes no count on a second run', async () => {
    const before = await tableCounts();

    const summary = await seedInitialData(db.client, ADMIN);

    expect(await tableCounts()).toEqual(before);
    for (const [table, count] of Object.entries(summary)) {
      expect([table, count.inserted]).toEqual([table, 0]);
    }
  });

  it('does not modify or resurrect what already exists', async () => {
    await db.client.query(
      `UPDATE modulo_formacion SET titulo = 'Título editado' WHERE numero = '3'`,
    );
    await db.client.query(
      `UPDATE pregunta_frecuente SET respuesta = 'Editada' WHERE pregunta = $1`,
      [FAQ_ENTRIES[0]?.question],
    );
    await db.client.query(`UPDATE nivel SET orden = 9 WHERE nombre = $1`, [LEVELS[0]?.name]);
    await db.client.query(
      `UPDATE usuario SET nombre_completo = 'Otro nombre' WHERE correo_institucional = $1`,
      [ADMIN.email],
    );
    const before = await tableCounts();

    await seedInitialData(db.client, ADMIN);

    expect(await tableCounts()).toEqual(before);
    expect((await rows(`SELECT titulo FROM modulo_formacion WHERE numero = '3'`))[0]?.titulo).toBe(
      'Título editado',
    );
    expect(
      (
        await rows(`SELECT respuesta FROM pregunta_frecuente WHERE pregunta = $1`, [
          FAQ_ENTRIES[0]?.question,
        ])
      )[0]?.respuesta,
    ).toBe('Editada');
    expect(
      (await rows(`SELECT orden FROM nivel WHERE nombre = $1`, [LEVELS[0]?.name]))[0]?.orden,
    ).toBe(9);
    expect(
      (
        await rows(`SELECT nombre_completo FROM usuario WHERE correo_institucional = $1`, [
          ADMIN.email,
        ])
      )[0]?.nombre_completo,
    ).toBe('Otro nombre');
  });

  it('leaves the database as it was when a step fails', async () => {
    const before = await tableCounts();
    await db.client.query('SAVEPOINT failing_seed');
    const { client } = spyClient('INSERT INTO usuario');

    await expect(
      seedInitialData(client, { ...ADMIN, email: 'otro-admin@gns.test' }),
    ).rejects.toThrow('Fallo simulado');
    await db.client.query('ROLLBACK TO SAVEPOINT failing_seed');

    expect(await tableCounts()).toEqual(before);
  });
});

describe('initial data validation', () => {
  it.each([
    ['both variables missing', {}],
    [
      'an invalid email',
      { SEED_ADMIN_NAME: 'Nombre', SEED_ADMIN_EMAIL: 'valor-secreto-no-correo' },
    ],
    ['an empty name', { SEED_ADMIN_NAME: '  ', SEED_ADMIN_EMAIL: 'a@gns.test' }],
  ])('rejects %s without printing the value', (_name, env) => {
    let message = '';
    try {
      parseAdminConfig(env);
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }

    expect(message).toContain('SEED_ADMIN_');
    expect(message).not.toContain('valor-secreto-no-correo');
  });

  it('accepts a valid administrator', () => {
    expect(
      parseAdminConfig({ SEED_ADMIN_NAME: ' Ana ', SEED_ADMIN_EMAIL: 'ana@gns.test' }),
    ).toEqual({ name: 'Ana', email: 'ana@gns.test' });
  });

  it('aborts before any query when an activity configuration is invalid', async () => {
    jest.resetModules();
    jest.doMock('../../prisma/seed/initial/benefits.data.ts', () => ({
      BENEFITS_MODULE_NUMBER: '8',
      BENEFITS_ACTIVITIES: [
        { type: 'conecta', title: 'Conecta rota', isRequired: true, config: { pares: [] } },
      ],
    }));
    const { seedInitialData: seedWithBrokenActivity } =
      await import('../../prisma/seed/initial/seed-initial.ts');
    const { client, queries } = spyClient();

    await expect(seedWithBrokenActivity(client, ADMIN)).rejects.toThrow(
      /módulo 8, orden 1, «Conecta rota»/,
    );
    expect(queries).toEqual([]);
    jest.dontMock('../../prisma/seed/initial/benefits.data.ts');
  });
});
