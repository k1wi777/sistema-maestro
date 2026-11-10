import {
  AreaType,
  parseActivityConfig,
  TrainingActivityStatus,
  TrainingActivityType,
  TrainingModuleStatus,
  UserRole,
  UserStatus,
} from '@gns/shared';
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
import {
  GENERAL_PLAN_NAME,
  INDUCTION_MODULES,
  TRAINING_SECTIONS,
} from '../../prisma/seed/initial/induction.data.ts';
import { seedInitialData } from '../../prisma/seed/initial/seed-initial.ts';
import { useTestDatabase } from './support/database';

const db = useTestDatabase();

const ADMIN = { name: 'Administrador de Prueba', email: 'seed-admin-prueba@gns.test' };

const SEEDED_TABLES = [
  'anio_lectivo',
  'nivel',
  'grado',
  'area',
  'periodo_academico',
  'plan_formacion',
  'seccion_plan',
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
      `SELECT m.numero, s.titulo AS seccion, m.orden, m.titulo, m.resumen, m.video_url, m.video_titulo,
              m.presentacion_url, m.estado
       FROM modulo_formacion m JOIN seccion_plan s ON s.id = m.seccion_id
       WHERE m.plan_id = $1 ORDER BY s.orden, m.orden`,
      [plans[0]?.id],
    );

    expect(modules).toEqual(
      INDUCTION_MODULES.map((module) => ({
        numero: module.number,
        seccion: TRAINING_SECTIONS.find((section) => section.key === module.section)?.title,
        orden: module.sortOrder,
        titulo: module.title,
        resumen: module.summary,
        video_url: module.videoUrl,
        video_titulo: module.videoTitle,
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

  it('has the General plan sections in order, with their modules numbered within each one', async () => {
    const sections = await rows(
      `SELECT s.titulo, s.subtitulo, s.orden,
              coalesce(array_agg(m.numero ORDER BY m.orden) FILTER (WHERE m.id IS NOT NULL), '{}') AS modulos,
              coalesce(array_agg(m.orden ORDER BY m.orden) FILTER (WHERE m.id IS NOT NULL), '{}') AS ordenes
       FROM seccion_plan s
       JOIN plan_formacion p ON p.id = s.plan_id AND p.area_id IS NULL AND p.anio_lectivo = $1
       LEFT JOIN modulo_formacion m ON m.seccion_id = s.id
       GROUP BY s.id ORDER BY s.orden`,
      [SCHOOL_YEAR],
    );

    // Igual en una base migrada desde `parte` que en una sembrada después de la migración.
    expect(sections).toEqual(
      TRAINING_SECTIONS.map((section, index) => {
        const modules = INDUCTION_MODULES.filter((module) => module.section === section.key);
        return {
          titulo: section.title,
          subtitulo: section.subtitle,
          orden: index + 1,
          modulos: modules.map((module) => module.number),
          ordenes: modules.map((module) => module.sortOrder),
        };
      }),
    );
    expect(sections.map((section) => section.ordenes)).toEqual([
      [1],
      [1, 2],
      [1, 2],
      [1, 2],
      [1, 2],
    ]);
  });

  it('keeps every module in a section of its own plan', async () => {
    const mismatched = await rows(
      `SELECT m.id FROM modulo_formacion m JOIN seccion_plan s ON s.id = m.seccion_id
       WHERE s.plan_id <> m.plan_id`,
    );

    expect(mismatched).toEqual([]);
  });

  it('has the text slides of modules 1 to 6 and none for modules 0, 7 and 8', async () => {
    const result = await rows(
      `SELECT m.numero, d.orden, d.titulo, d.ideas_clave
       FROM diapositiva d JOIN modulo_formacion m ON m.id = d.modulo_id
       JOIN plan_formacion p ON p.id = m.plan_id
       WHERE p.area_id IS NULL AND p.anio_lectivo = $1 ORDER BY m.numero::int, d.orden`,
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
       GROUP BY m.numero, m.orden, q.id ORDER BY m.numero::int, q.orden`,
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
        estado: TrainingActivityStatus.Active,
      })),
    );
    expect(activities.filter((activity) => activity.obligatoria).map((a) => a.titulo)).toEqual([
      'Conecta',
      '¿Verdad o mito?',
    ]);
  });

  it('has the prototype video titles, also on modules without a link', async () => {
    const modules = await rows(
      `SELECT m.numero, m.video_titulo, m.video_url FROM modulo_formacion m
       JOIN plan_formacion p ON p.id = m.plan_id JOIN seccion_plan s ON s.id = m.seccion_id
       WHERE p.area_id IS NULL ORDER BY s.orden, m.orden`,
    );

    expect(modules.map((module) => module.video_titulo)).toEqual([
      'Video de bienvenida',
      'Video 1 · Antecedente histórico GNS',
      'Video 2 · Objetivo del modelo GNS',
      'Video 3 · Propuesta pedagógica',
      'Video 4 · Claves y diferenciadores',
      'Video 5 · Recomendaciones Preescolar Bajo',
      'Video 6 · Recomendaciones Preescolar Alto',
      'Video · Nuestro talento humano',
      'Video · Plan de beneficios',
    ]);
    expect(modules.filter((module) => module.video_url === null).map((m) => m.numero)).toEqual([
      '0',
      '7',
      '8',
    ]);
  });

  it('has the activity instructions and the default Challenge settings on the modules', async () => {
    const activities = await rows(
      `SELECT titulo, instrucciones FROM actividad_modulo ORDER BY orden`,
    );
    const modules = await rows(
      `SELECT DISTINCT umbral_aprobacion, segundos_por_pregunta FROM modulo_formacion`,
    );

    expect(activities).toEqual(
      BENEFITS_ACTIVITIES.map((activity) => ({
        titulo: activity.title,
        instrucciones: activity.instructions ?? null,
      })),
    );
    expect(activities.map((activity) => activity.instrucciones !== null)).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
    expect(modules).toEqual([{ umbral_aprobacion: 80, segundos_por_pregunta: null }]);
  });

  it('has the referral link and the simulator presentation data from the prototype', async () => {
    const stored = await rows(
      `SELECT tipo, titulo, configuracion FROM actividad_modulo ORDER BY orden`,
    );
    const config = (title: string): Row =>
      stored.find((activity) => activity.titulo === title)?.configuracion as Row;
    const wheel = config('Ruleta de beneficios') as { tarjetas: Row[] };
    const referrals = wheel.tarjetas.find((card) => card.clave === 'referidos');
    const simulators = stored.filter(
      (activity) => activity.tipo === TrainingActivityType.Simulator,
    );

    expect(referrals?.enlace).toMatchObject({ texto: 'Formulario de referidos' });
    expect(String((referrals?.enlace as Row).url)).toMatch(/^https:\/\//);
    expect(
      Object.fromEntries(
        simulators.map((activity) => [activity.titulo, (activity.configuracion as Row).icono]),
      ),
    ).toEqual({
      'Simulador de ahorro mutuo': '🐷',
      'Simulador de bono de desempeño': '🏅',
      'Simulador de bono de antigüedad': '📈',
      'Simulador de cabaña en Coveñas': '🏖️',
      'Simulador de bilingüismo': '🗣️',
    });
    for (const activity of simulators) {
      const simulator = activity.configuracion as {
        destacado: { clave: string; subtitulo: string };
        resultados: { clave: string }[];
      };
      expect(simulator.resultados.map((result) => result.clave)).toContain(
        simulator.destacado.clave,
      );
      expect(
        parseActivityConfig(TrainingActivityType.Simulator, activity.configuracion).success,
      ).toBe(true);
    }
    for (const title of ['Simulador de ahorro mutuo', 'Simulador de bono de antigüedad']) {
      const inputs = (config(title) as { entradas: Row[] }).entradas;
      expect(inputs.find((input) => input.clave === 'anios')?.unidad).toBe('años');
    }
  });

  it('stores the performance bonus simulator with the corrected `mitad_siguiente` key', async () => {
    const [stored] = await rows(
      `SELECT configuracion FROM actividad_modulo WHERE titulo = 'Simulador de bono de desempeño'`,
    );
    const seeded = BENEFITS_ACTIVITIES.find(
      (activity) => activity.title === 'Simulador de bono de desempeño',
    );

    // Una base sembrada antes de BE-7 la recibe por la migración; una nueva, por el seed.
    expect(stored?.configuracion).toEqual(
      parseActivityConfig(TrainingActivityType.Simulator, seeded?.config).data,
    );
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

describe('año lectivo vigente', () => {
  it('registers 2026-2027 with its three periods', async () => {
    const years = await rows(`SELECT codigo FROM anio_lectivo WHERE codigo = $1`, [SCHOOL_YEAR]);
    const periods = await rows(`SELECT numero FROM periodo_academico WHERE anio_lectivo = $1`, [
      SCHOOL_YEAR,
    ]);

    expect(years).toEqual([{ codigo: '2026-2027' }]);
    expect(periods).toHaveLength(ACADEMIC_PERIOD_NUMBERS.length);
  });

  it('leaves exactly one current year and keeps it after a second load', async () => {
    const current = async () => rows(`SELECT codigo FROM anio_lectivo WHERE vigente`);

    expect((await current()).length).toBe(1);
    const before = await current();
    await seedInitialData(db.client, ADMIN);

    expect(await current()).toEqual(before);
  });

  it('marks 2026-2027 current when no year is', async () => {
    await db.client.query(`UPDATE anio_lectivo SET vigente = NULL`);

    await seedInitialData(db.client, ADMIN);

    expect(await rows(`SELECT codigo FROM anio_lectivo WHERE vigente`)).toEqual([
      { codigo: SCHOOL_YEAR },
    ]);
  });

  it('does not change a current year that administration marked', async () => {
    await db.client.query(`UPDATE anio_lectivo SET vigente = NULL`);
    await db.client.query(`INSERT INTO anio_lectivo (codigo, vigente) VALUES ('2027-2028', true)`);

    await seedInitialData(db.client, ADMIN);

    expect(await rows(`SELECT codigo FROM anio_lectivo WHERE vigente`)).toEqual([
      { codigo: '2027-2028' },
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
