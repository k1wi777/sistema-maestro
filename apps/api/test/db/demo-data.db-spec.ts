import {
  AuditLogType,
  JournalEventType,
  ObserverNoteType,
  RecordStatus,
  ReviewAction,
  ReviewRecordType,
  TrainingActivityType,
  UserRole,
  UserStatus,
} from '@gns/shared';
import type { Client } from 'pg';
import { DEMO_EMAIL_DOMAIN, REVIEW_RESULT_STATUS } from '../../prisma/seed/demo/demo.data.ts';
import { isDemoLoaded, loadDemoData } from '../../prisma/seed/demo/load-demo.ts';
import { useTestDatabase } from './support/database';

const db = useTestDatabase();

const DEMO_LIKE = `%@${DEMO_EMAIL_DOMAIN}`;

type Row = Record<string, unknown>;

async function rows(sql: string, params: unknown[] = []): Promise<Row[]> {
  return (await db.client.query<Row>(sql, params)).rows;
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  return Number((await rows(sql, params))[0]?.count);
}

async function demoTableCounts(): Promise<Record<string, number>> {
  const tables = [
    'usuario',
    'planeacion',
    'diario_campo',
    'revision',
    'progreso_modulo',
    'bitacora',
  ];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    counts[table] = await count(`SELECT count(*) FROM ${table}`);
  }
  return counts;
}

// Con los datos demo ya cargados se inspeccionan tal cual; si no, se cargan dentro
// de la transacción de la prueba, que termina en ROLLBACK.
beforeEach(async () => {
  if (!(await isDemoLoaded(db.client))) {
    await loadDemoData(db.client);
  }
});

const DEMO_TEACHERS = `(SELECT id FROM usuario WHERE correo_institucional LIKE $1 AND rol = 'docente')`;

describe('demo users and assignments (R18)', () => {
  it('has coordinators and teachers, at least one inactive', async () => {
    const users = await rows(
      `SELECT rol, estado, count(*)::int AS total FROM usuario WHERE correo_institucional LIKE $1
       GROUP BY rol, estado`,
      [DEMO_LIKE],
    );
    const total = (role: string, status?: string) =>
      users
        .filter((row) => row.rol === role && (status === undefined || row.estado === status))
        .reduce((sum, row) => sum + Number(row.total), 0);

    expect(total(UserRole.Coordinator)).toBeGreaterThanOrEqual(2);
    expect(total(UserRole.Teacher)).toBeGreaterThanOrEqual(5);
    expect(total(UserRole.Teacher, UserStatus.Inactive)).toBeGreaterThanOrEqual(1);
    expect(total(UserRole.Administrator)).toBe(0);
  });

  it('assigns teachers in the four levels, with homeroom directions', async () => {
    const levels = await rows(
      `SELECT DISTINCT n.nombre FROM asignacion_docente a
       JOIN grado g ON g.id = a.grado_id JOIN nivel n ON n.id = g.nivel_id
       WHERE a.anio_lectivo = '2026-2027' AND a.docente_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );
    const homeroom = await count(
      `SELECT count(*) FROM asignacion_docente WHERE es_director_grupo AND docente_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );

    expect(levels).toHaveLength(4);
    expect(homeroom).toBeGreaterThanOrEqual(2);
  });
});

describe('demo records (R19)', () => {
  const states = Object.values(RecordStatus);

  it.each([
    ['planeacion', 'docente_id'],
    ['diario_campo', 'docente_id'],
    ['observador_anotacion', 'docente_id'],
  ])('has %s in each of the 5 states', async (table, teacherColumn) => {
    const found = await rows(
      `SELECT DISTINCT estado FROM ${table} WHERE ${teacherColumn} IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );

    expect(found.map((row) => row.estado).sort()).toEqual([...states].sort());
  });

  it('sets the submission date on every submitted lesson plan and journal', async () => {
    for (const table of ['planeacion', 'diario_campo']) {
      const inconsistent = await count(
        `SELECT count(*) FROM ${table} WHERE docente_id IN ${DEMO_TEACHERS}
         AND ((estado = 'borrador') <> (enviada_en IS NULL))`,
        [DEMO_LIKE],
      );
      expect([table, inconsistent]).toEqual([table, 0]);
    }
  });

  it('uses learning corners in preschool, the CurioCity stage in secondary and a linked resource', async () => {
    const preschool = await count(
      `SELECT count(*) FROM planeacion p JOIN grado g ON g.id = p.grado_id JOIN nivel n ON n.id = g.nivel_id
       WHERE p.docente_id IN ${DEMO_TEACHERS} AND n.nombre LIKE 'Preescolar%' AND p.rincon IS NOT NULL`,
      [DEMO_LIKE],
    );
    const secondary = await count(
      `SELECT count(*) FROM planeacion p JOIN grado g ON g.id = p.grado_id JOIN nivel n ON n.id = g.nivel_id
       WHERE p.docente_id IN ${DEMO_TEACHERS} AND n.nombre = 'Bachillerato' AND p.etapa_curiocity IS NOT NULL`,
      [DEMO_LIKE],
    );
    const resources = await count(
      `SELECT count(*) FROM recurso_planeacion r JOIN planeacion p ON p.id = r.planeacion_id
       WHERE p.docente_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );

    expect(preschool).toBeGreaterThanOrEqual(1);
    expect(secondary).toBeGreaterThanOrEqual(1);
    expect(resources).toBeGreaterThanOrEqual(1);
  });

  it('has journals with 2 to 4 entries covering the 3 event types', async () => {
    const perJournal = await rows(
      `SELECT count(e.id)::int AS total FROM diario_campo d LEFT JOIN diario_entrada e ON e.diario_id = d.id
       WHERE d.docente_id IN ${DEMO_TEACHERS} GROUP BY d.id`,
      [DEMO_LIKE],
    );
    const types = await rows(
      `SELECT DISTINCT e.tipo_evento FROM diario_entrada e JOIN diario_campo d ON d.id = e.diario_id
       WHERE d.docente_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );

    expect(perJournal.every((row) => Number(row.total) >= 2 && Number(row.total) <= 4)).toBe(true);
    expect(types.map((row) => row.tipo_evento).sort()).toEqual(
      Object.values(JournalEventType).sort(),
    );
  });

  it('has observer notes of the 6 types', async () => {
    const types = await rows(
      `SELECT DISTINCT tipo FROM observador_anotacion WHERE docente_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );

    expect(types.map((row) => row.tipo).sort()).toEqual(Object.values(ObserverNoteType).sort());
  });
});

describe('demo reviews (R20)', () => {
  const TARGETS: Record<string, string> = {
    [ReviewRecordType.LessonPlan]: 'planeacion',
    [ReviewRecordType.FieldJournal]: 'diario_campo',
    [ReviewRecordType.ObserverNote]: 'observador_anotacion',
  };

  async function demoReviews(): Promise<Row[]> {
    return rows(
      `SELECT r.tipo_registro, r.registro_id, r.accion, r.fecha FROM revision r
       WHERE r.revisor_id IN (SELECT id FROM usuario WHERE correo_institucional LIKE $1)`,
      [DEMO_LIKE],
    );
  }

  it('covers the 3 record types and the 3 actions', async () => {
    const reviews = await demoReviews();

    expect([...new Set(reviews.map((row) => row.tipo_registro))].sort()).toEqual(
      Object.values(ReviewRecordType).sort(),
    );
    expect([...new Set(reviews.map((row) => row.accion))].sort()).toEqual(
      Object.values(ReviewAction).sort(),
    );
  });

  it('leaves each reviewed record in the state its last review implies', async () => {
    const reviews = (await demoReviews()).sort(
      (a, b) => new Date(a.fecha as Date).getTime() - new Date(b.fecha as Date).getTime(),
    );
    const last = new Map(
      reviews.map((row) => [`${String(row.tipo_registro)}:${String(row.registro_id)}`, row]),
    );

    expect(last.size).toBeGreaterThanOrEqual(8);
    for (const review of last.values()) {
      const table = TARGETS[String(review.tipo_registro)];
      const record = (
        await rows(`SELECT estado FROM ${table} WHERE id = $1`, [review.registro_id])
      )[0];

      expect(record?.estado).toBe(REVIEW_RESULT_STATUS[review.accion as ReviewAction]);
    }
  });

  it('records the adjusted fields of an adjustment', async () => {
    const adjustments = await rows(
      `SELECT campos_ajustados FROM revision WHERE accion = 'ajuste'
       AND revisor_id IN (SELECT id FROM usuario WHERE correo_institucional LIKE $1)`,
      [DEMO_LIKE],
    );

    expect(adjustments.length).toBeGreaterThan(0);
    for (const row of adjustments) {
      expect((row.campos_ajustados as string[]).length).toBeGreaterThan(0);
    }
  });
});

describe('demo training progress (R21 and R22)', () => {
  it('has finished, in-progress and not-started modules', async () => {
    const finished = await count(
      `SELECT count(*) FROM progreso_modulo WHERE terminado_en IS NOT NULL AND docente_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );
    const inProgress = await count(
      `SELECT count(*) FROM progreso_modulo WHERE terminado_en IS NULL AND docente_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );
    const notStarted = await count(
      `SELECT count(*) FROM usuario u CROSS JOIN modulo_formacion m
       JOIN plan_formacion p ON p.id = m.plan_id AND p.area_id IS NULL
       WHERE u.rol = 'docente' AND u.correo_institucional LIKE $1
         AND NOT EXISTS (SELECT 1 FROM progreso_modulo x WHERE x.docente_id = u.id AND x.modulo_id = m.id)`,
      [DEMO_LIKE],
    );

    expect(finished).toBeGreaterThan(0);
    expect(inProgress).toBeGreaterThan(0);
    expect(notStarted).toBeGreaterThan(0);
  });

  it('has passed and failed challenge attempts with a coherent best score', async () => {
    const attempts = await rows(
      `SELECT i.puntaje FROM intento_desafio i JOIN progreso_modulo p ON p.id = i.progreso_id
       WHERE p.docente_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );
    const incoherent = await count(
      `SELECT count(*) FROM progreso_modulo p
       WHERE p.docente_id IN ${DEMO_TEACHERS}
         AND (p.mejor_puntaje IS DISTINCT FROM (SELECT max(puntaje) FROM intento_desafio WHERE progreso_id = p.id)
              OR (p.aprobado_en IS NOT NULL) <> (coalesce(p.mejor_puntaje, 0) >= 80))`,
      [DEMO_LIKE],
    );

    expect(attempts.some((row) => Number(row.puntaje) >= 80)).toBe(true);
    expect(attempts.some((row) => Number(row.puntaje) < 80)).toBe(true);
    expect(incoherent).toBe(0);
  });

  it('only finishes a module when the termination rule holds', async () => {
    const violations = await count(
      `SELECT count(*) FROM progreso_modulo p JOIN modulo_formacion m ON m.id = p.modulo_id
       WHERE p.terminado_en IS NOT NULL AND p.docente_id IN ${DEMO_TEACHERS}
         AND NOT (
           (m.video_url IS NULL OR p.video_visto_en IS NOT NULL)
           AND (
             (NOT EXISTS (SELECT 1 FROM diapositiva d WHERE d.modulo_id = m.id) AND m.presentacion_url IS NULL)
             OR p.presentacion_vista_en IS NOT NULL)
           AND (NOT EXISTS (SELECT 1 FROM pregunta_desafio q WHERE q.modulo_id = m.id)
                OR (p.aprobado_en IS NOT NULL AND p.mejor_puntaje >= 80))
           AND NOT EXISTS (
             SELECT 1 FROM actividad_modulo a
             WHERE a.modulo_id = m.id AND a.obligatoria AND a.estado = 'activo'
               AND NOT EXISTS (SELECT 1 FROM progreso_actividad pa
                               WHERE pa.actividad_id = a.id AND pa.docente_id = p.docente_id
                                 AND pa.completada_en IS NOT NULL)))`,
      [DEMO_LIKE],
    );

    expect(violations).toBe(0);
  });

  it('covers passport, match, true-or-myth and simulator progress', async () => {
    const progress = await rows(
      `SELECT a.tipo, a.titulo, pa.completada_en IS NOT NULL AS completada, pa.mejor_puntaje,
              pa.detalle, jsonb_array_length(a.configuracion->'tarjetas') AS tarjetas
       FROM progreso_actividad pa JOIN actividad_modulo a ON a.id = pa.actividad_id
       WHERE pa.docente_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );
    const of = (type: string, completed: boolean) =>
      progress.filter((row) => row.tipo === type && row.completada === completed);

    const wheel = progress.filter((row) => row.tipo === TrainingActivityType.WheelPassport);
    const stamps = (row: Row) => ((row.detalle as { sellos: string[] }).sellos ?? []).length;
    expect(wheel.some((row) => row.completada && stamps(row) === Number(row.tarjetas))).toBe(true);
    expect(wheel.some((row) => !row.completada && stamps(row) > 0)).toBe(true);
    expect(of(TrainingActivityType.Match, true).length).toBeGreaterThan(0);
    expect(of(TrainingActivityType.Match, false).length).toBeGreaterThan(0);
    expect(of(TrainingActivityType.TrueOrMyth, true).length).toBeGreaterThan(0);
    expect(of(TrainingActivityType.TrueOrMyth, false).length).toBeGreaterThan(0);
    expect(of(TrainingActivityType.Simulator, true).length).toBeGreaterThan(0);
  });

  it('never stores simulator values', async () => {
    const stored = await count(
      `SELECT count(*) FROM progreso_actividad pa JOIN actividad_modulo a ON a.id = pa.actividad_id
       WHERE a.tipo = 'simulador' AND pa.detalle IS NOT NULL`,
    );

    expect(stored).toBe(0);
  });

  it('has audit log entries for the actions that generate them', async () => {
    const entries = await rows(
      `SELECT tipo, usuario_id, rol FROM bitacora
       WHERE usuario_id IN (SELECT id FROM usuario WHERE correo_institucional LIKE $1)
          OR (usuario_id IS NULL AND rol = 'desconocido')`,
      [DEMO_LIKE],
    );
    const types = new Set(entries.map((row) => row.tipo));

    expect(entries.length).toBeGreaterThanOrEqual(30);
    for (const type of [
      AuditLogType.Login,
      AuditLogType.LessonPlan,
      AuditLogType.FieldJournal,
      AuditLogType.ObserverNote,
      AuditLogType.Training,
      AuditLogType.Coordination,
    ]) {
      expect(types.has(type)).toBe(true);
    }
    expect(entries.some((row) => row.usuario_id === null)).toBe(true);
  });
});

describe('demo privacy (R23)', () => {
  it('uses a reserved, non-routable email domain', async () => {
    const emails = await rows(
      `SELECT correo_institucional FROM usuario WHERE correo_institucional LIKE $1`,
      [DEMO_LIKE],
    );

    expect(emails.length).toBeGreaterThan(0);
    for (const row of emails) {
      expect(String(row.correo_institucional)).toMatch(/@demo\.gns\.test$/);
    }
  });

  it('stores only one-word first names for students', async () => {
    const notes = await rows(
      `SELECT estudiante_nombre FROM observador_anotacion WHERE docente_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );
    const journalEntries = await rows(
      `SELECT e.estudiantes FROM diario_entrada e JOIN diario_campo d ON d.id = e.diario_id
       WHERE d.docente_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );
    const oneWord = /^[\p{L}]+$/u;

    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) {
      expect(String(note.estudiante_nombre)).toMatch(oneWord);
    }
    for (const entry of journalEntries) {
      const names = String(entry.estudiantes)
        .split(',')
        .map((name) => name.trim());
      for (const name of names) {
        expect(name).toMatch(oneWord);
      }
    }
  });
});

describe('loadDemoData guards (R24)', () => {
  it('rejects a second load without writing anything', async () => {
    const before = await demoTableCounts();

    await expect(loadDemoData(db.client)).rejects.toThrow(/ya están cargados/);

    expect(await demoTableCounts()).toEqual(before);
  });

  it('rejects a load when the initial data is missing, before any write', async () => {
    const statements: string[] = [];
    const emptyDatabase = {
      query: (sql: string) => {
        statements.push(sql);
        return Promise.resolve({ rows: [], rowCount: 0 });
      },
    } as unknown as Client;

    await expect(loadDemoData(emptyDatabase)).rejects.toThrow(/Faltan los datos iniciales/);

    expect(statements.some((sql) => /^\s*(INSERT|UPDATE|DELETE)/i.test(sql))).toBe(false);
  });
});
