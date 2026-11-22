import {
  AuditLogType,
  crossCuttingProjectFor,
  JournalStatus,
  isStudentFirstName,
  levelAllowsCuriocity,
  ObserverNoteType,
  RecordStatus,
  REVIEW_DECISION_RESULT_STATUS,
  ReviewAction,
  ReviewDecision,
  ReviewRecordType,
  TrainingActivityType,
  UserRole,
  UserStatus,
} from '@gns/shared';
import type { Client } from 'pg';
import { DEMO_EMAIL_DOMAIN } from '../../prisma/seed/demo/demo.data.ts';
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
    'actividad_repositorio',
    'favorito_actividad',
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
       JOIN grupo gr ON gr.id = a.grupo_id JOIN grado g ON g.id = gr.grado_id
       JOIN nivel n ON n.id = g.nivel_id
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

  it('keeps assignments in active groups, with one homeroom per group and year', async () => {
    const outsideGrades = await count(
      `SELECT count(*) FROM asignacion_docente a JOIN grupo gr ON gr.id = a.grupo_id
       WHERE a.docente_id IN ${DEMO_TEACHERS} AND NOT gr.activo`,
      [DEMO_LIKE],
    );
    const duplicated = await count(
      `SELECT count(*) FROM (
         SELECT grupo_id, anio_lectivo FROM asignacion_docente
         WHERE es_director_grupo AND estado = 'activa'
         GROUP BY grupo_id, anio_lectivo HAVING count(*) > 1) AS d`,
    );

    expect([outsideGrades, duplicated]).toEqual([0, 0]);
  });

  it('puts the demo coordinators in charge of the preschool, primary and secondary grades and leaves First Grade without one', async () => {
    const coordinators = await rows(
      `SELECT g.nombre AS grado, u.nombre_completo AS coordinadora FROM grado g
       JOIN usuario u ON u.id = g.coordinador_id WHERE u.correo_institucional LIKE $1 ORDER BY g.orden`,
      [DEMO_LIKE],
    );
    const firstGrade = await rows(`SELECT coordinador_id FROM grado WHERE nombre = 'First Grade'`);

    expect(coordinators).toEqual([
      ...['Red', 'Blue', 'Purple', 'Green', 'Garden'].map((grado) => ({
        grado,
        coordinadora: 'Elena Ravassa',
      })),
      { grado: 'Kinder', coordinadora: 'Tomás Aldaverde' },
      { grado: 'Transition', coordinadora: 'Tomás Aldaverde' },
      ...['3°', '4°', '5°'].map((grado) => ({ grado, coordinadora: 'Elena Ravassa' })),
      ...['7°', '8°', '10°', '11°'].map((grado) => ({ grado, coordinadora: 'Tomás Aldaverde' })),
    ]);
    expect(firstGrade).toEqual([{ coordinador_id: null }]);
  });

  it('adds groups «<grade> 1» for the non-preschool grades the demo uses', async () => {
    const groups = await rows(
      `SELECT g.nombre AS grado, gr.nombre FROM grupo gr JOIN grado g ON g.id = gr.grado_id
       WHERE g.nombre IN ('First Grade', '3°', '10°') ORDER BY g.orden`,
    );

    expect(groups).toEqual([
      { grado: 'First Grade', nombre: 'First Grade 1' },
      { grado: '3°', nombre: '3° 1' },
      { grado: '10°', nombre: '10° 1' },
    ]);
  });
});

describe('demo records (R19)', () => {
  const states = Object.values(RecordStatus);

  it.each([
    ['planeacion', 'docente_id'],
    ['observador_anotacion', 'docente_id'],
  ])('has %s in each of the 5 states', async (table, teacherColumn) => {
    const found = await rows(
      `SELECT DISTINCT estado FROM ${table} WHERE ${teacherColumn} IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );

    expect(found.map((row) => row.estado).sort()).toEqual([...states].sort());
  });

  it('gives every lesson plan at least one area, all of them assigned to its teacher in that grade (#99)', async () => {
    const withoutArea = await count(
      `SELECT count(*) FROM planeacion p WHERE p.docente_id IN ${DEMO_TEACHERS}
       AND NOT EXISTS (SELECT 1 FROM planeacion_area pa WHERE pa.planeacion_id = p.id)`,
      [DEMO_LIKE],
    );
    const unassigned = await count(
      `SELECT count(*) FROM planeacion p JOIN planeacion_area pa ON pa.planeacion_id = p.id
       WHERE p.docente_id IN ${DEMO_TEACHERS}
       AND NOT EXISTS (
         SELECT 1 FROM asignacion_docente d JOIN grupo gr ON gr.id = d.grupo_id
         WHERE d.docente_id = p.docente_id
         AND gr.grado_id = p.grado_id AND d.area_id = pa.area_id AND d.estado = 'activa')`,
      [DEMO_LIKE],
    );

    expect([withoutArea, unassigned]).toEqual([0, 0]);
  });

  it('has a delivered lesson plan with two areas and the rest with one (R16)', async () => {
    const perPlan = await rows(
      `SELECT p.tema, p.estado, count(*) AS areas FROM planeacion p
       JOIN planeacion_area pa ON pa.planeacion_id = p.id
       WHERE p.docente_id IN ${DEMO_TEACHERS} GROUP BY p.id, p.tema, p.estado`,
      [DEMO_LIKE],
    );
    const several = perPlan.filter((row) => Number(row.areas) > 1);

    expect(several).toHaveLength(1);
    expect(several[0]).toMatchObject({
      tema: 'Fracciones en la tienda escolar',
      estado: RecordStatus.Reviewed,
    });
    expect(Number(several[0]?.areas)).toBe(2);
  });

  it('sets the submission date on every submitted lesson plan', async () => {
    const inconsistent = await count(
      `SELECT count(*) FROM planeacion WHERE docente_id IN ${DEMO_TEACHERS}
       AND ((estado = 'borrador') <> (enviada_en IS NULL))`,
      [DEMO_LIKE],
    );

    expect(inconsistent).toBe(0);
  });

  it('gives every lesson plan the cross-cutting project of its level and period, and CurioCity only in secondary', async () => {
    const plans = await rows(
      `SELECT p.proyecto_transversal, p.etapa_curiocity, n.nombre AS nivel, pa.numero
       FROM planeacion p JOIN grado g ON g.id = p.grado_id JOIN nivel n ON n.id = g.nivel_id
       JOIN periodo_academico pa ON pa.id = p.periodo_id
       WHERE p.docente_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );

    expect(plans.length).toBeGreaterThan(0);
    for (const plan of plans) {
      const level = String(plan.nivel);
      expect([level, plan.numero, plan.proyecto_transversal]).toEqual([
        level,
        plan.numero,
        crossCuttingProjectFor(level, Number(plan.numero)),
      ]);
      if (plan.etapa_curiocity !== null) {
        expect(levelAllowsCuriocity(level)).toBe(true);
      }
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

  describe('collaborative field journals (#107)', () => {
    const DEMO_JOURNALS = `(SELECT d.id FROM diario_campo d WHERE d.creado_por IN ${DEMO_TEACHERS})`;

    it('has journals by group and day in each of the 5 states', async () => {
      const found = await rows(
        `SELECT DISTINCT estado FROM diario_campo WHERE creado_por IN ${DEMO_TEACHERS}`,
        [DEMO_LIKE],
      );

      expect(found.map((row) => row.estado).sort()).toEqual(Object.values(JournalStatus).sort());
    });

    it('dates every journal between 13 October and 9 November 2026 and never a 7° 1 journal from 13 November on', async () => {
      const outside = await count(
        `SELECT count(*) FROM diario_campo WHERE id IN ${DEMO_JOURNALS}
         AND fecha NOT BETWEEN '2026-10-13' AND '2026-11-09'`,
        [DEMO_LIKE],
      );
      const late = await count(
        `SELECT count(*) FROM diario_campo d JOIN grupo gr ON gr.id = d.grupo_id
         JOIN grado g ON g.id = gr.grado_id
         WHERE g.nombre = '7°' AND d.fecha >= '2026-11-13'`,
      );

      expect([outside, late]).toEqual([0, 0]);
    });

    it('keeps the submission date consistent with the state', async () => {
      const inconsistent = await count(
        `SELECT count(*) FROM diario_campo WHERE id IN ${DEMO_JOURNALS}
         AND ((estado IN ('enviado', 'observaciones', 'revisado')) <> (enviado_en IS NOT NULL))
         AND NOT (estado = 'anulado')`,
        [DEMO_LIKE],
      );
      const voided = await count(
        `SELECT count(*) FROM diario_campo WHERE id IN ${DEMO_JOURNALS}
         AND ((estado = 'anulado') <> (anulado_en IS NOT NULL AND anulado_por IS NOT NULL))`,
        [DEMO_LIKE],
      );

      expect([inconsistent, voided]).toEqual([0, 0]);
    });

    it('has annotations only from teachers assigned to the group that year, covering the 3 states', async () => {
      const strangers = await count(
        `SELECT count(*) FROM diario_anotacion a JOIN diario_campo d ON d.id = a.diario_id
         WHERE d.id IN ${DEMO_JOURNALS} AND NOT EXISTS (
           SELECT 1 FROM asignacion_docente ad WHERE ad.docente_id = a.docente_id
           AND ad.grupo_id = d.grupo_id AND ad.area_id = a.area_id
           AND ad.anio_lectivo = d.anio_lectivo AND ad.estado = 'activa')`,
        [DEMO_LIKE],
      );
      const states = await rows(
        `SELECT DISTINCT estado FROM diario_anotacion WHERE diario_id IN ${DEMO_JOURNALS}`,
        [DEMO_LIKE],
      );

      expect(strangers).toBe(0);
      expect(states.map((row) => row.estado).sort()).toEqual(['borrador', 'lista', 'observada']);
    });

    it('records a coherent n of m for every submission and never lists a teacher who contributed as missing', async () => {
      const submissions = await rows(
        `SELECT e.diario_id, e.aportes_listos, e.docentes_esperados, e.faltantes, e.director_id
         FROM diario_envio e WHERE e.diario_id IN ${DEMO_JOURNALS}`,
        [DEMO_LIKE],
      );

      expect(submissions.length).toBeGreaterThanOrEqual(4);
      for (const submission of submissions) {
        const missing = submission.faltantes as { docenteId: string }[];
        expect(Number(submission.aportes_listos) + missing.length).toBe(
          Number(submission.docentes_esperados),
        );
        const contributed = await rows(
          `SELECT DISTINCT docente_id FROM diario_anotacion
           WHERE diario_id = $1 AND estado IN ('lista', 'observada')`,
          [submission.diario_id],
        );
        for (const entry of missing) {
          expect(contributed.map((row) => row.docente_id)).not.toContain(entry.docenteId);
        }
        // El director(a) del envío dirige el grupo ese año.
        const homeroom = await count(
          `SELECT count(*) FROM asignacion_docente ad JOIN diario_campo d ON d.grupo_id = ad.grupo_id
           WHERE d.id = $1 AND ad.docente_id = $2 AND ad.es_director_grupo AND ad.estado = 'activa'`,
          [submission.diario_id, submission.director_id],
        );
        expect(homeroom).toBeGreaterThan(0);
      }
    });

    it('covers the special cases of the board: a group without homeroom, a grade without coordinator, one observed annotation and one general observation', async () => {
      const withoutHomeroom = await count(
        `SELECT count(*) FROM diario_campo d WHERE d.id IN ${DEMO_JOURNALS} AND NOT EXISTS (
           SELECT 1 FROM asignacion_docente ad WHERE ad.grupo_id = d.grupo_id
           AND ad.es_director_grupo AND ad.estado = 'activa')`,
        [DEMO_LIKE],
      );
      const withoutCoordinator = await count(
        `SELECT count(*) FROM diario_campo d JOIN grupo gr ON gr.id = d.grupo_id
         JOIN grado g ON g.id = gr.grado_id WHERE d.id IN ${DEMO_JOURNALS} AND g.coordinador_id IS NULL`,
        [DEMO_LIKE],
      );
      const observations = await count(
        `SELECT count(*) FROM diario_observacion o JOIN diario_anotacion a ON a.id = o.anotacion_id
         WHERE a.diario_id IN ${DEMO_JOURNALS} AND a.estado = 'observada'`,
        [DEMO_LIKE],
      );
      const general = await count(
        `SELECT count(*) FROM revision r JOIN diario_campo d ON d.id = r.registro_id
         WHERE r.tipo_registro = 'diario' AND r.accion = 'observaciones' AND r.comentario IS NOT NULL
         AND d.estado = 'observaciones'`,
      );

      expect(withoutHomeroom).toBeGreaterThanOrEqual(1);
      expect(withoutCoordinator).toBeGreaterThanOrEqual(1);
      expect(observations).toBeGreaterThanOrEqual(1);
      expect(general).toBeGreaterThanOrEqual(1);
    });
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

      // `ajuste` nunca es la última fila: no determina estado y siempre lo sigue una decisión.
      expect(review.accion).not.toBe(ReviewAction.Adjustment);
      // El diario tiene estados propios (sin ajustes): devolver deja «observaciones» y aprobar, «revisado».
      const expected =
        review.tipo_registro === ReviewRecordType.FieldJournal
          ? {
              [ReviewAction.ChangesRequested]: 'observaciones',
              [ReviewAction.Approved]: 'revisado',
            }[review.accion as ReviewDecision]
          : REVIEW_DECISION_RESULT_STATUS[review.accion as ReviewDecision];
      expect(record?.estado).toBe(expected);
    }
  });

  it('follows every adjustment with a decision on the same record', async () => {
    const reviews = await demoReviews();
    const adjustments = reviews.filter((row) => row.accion === ReviewAction.Adjustment);

    expect(adjustments.length).toBeGreaterThan(0);
    for (const adjustment of adjustments) {
      const decided = reviews.some(
        (row) =>
          row.registro_id === adjustment.registro_id &&
          row.accion !== ReviewAction.Adjustment &&
          new Date(row.fecha as Date) > new Date(adjustment.fecha as Date),
      );

      expect(decided).toBe(true);
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

describe('demo certificates (BE-7)', () => {
  it('has one certificate for every finished module and none for the others', async () => {
    const missing = await count(
      `SELECT count(*) FROM progreso_modulo p
       WHERE p.terminado_en IS NOT NULL AND p.docente_id IN ${DEMO_TEACHERS}
         AND NOT EXISTS (SELECT 1 FROM certificado c
                         WHERE c.docente_id = p.docente_id AND c.modulo_id = p.modulo_id
                           AND c.emitido_en = p.terminado_en)`,
      [DEMO_LIKE],
    );
    const unfinished = await count(
      `SELECT count(*) FROM certificado c
       WHERE c.modulo_id IS NOT NULL AND c.docente_id IN ${DEMO_TEACHERS}
         AND NOT EXISTS (SELECT 1 FROM progreso_modulo p
                         WHERE p.docente_id = c.docente_id AND p.modulo_id = c.modulo_id
                           AND p.terminado_en IS NOT NULL)`,
      [DEMO_LIKE],
    );

    expect(missing).toBe(0);
    expect(unfinished).toBe(0);
  });

  it('has the route certificate only for the teacher who finished every module', async () => {
    const route = await rows(
      `SELECT u.nombre_completo, c.titulo FROM certificado c JOIN usuario u ON u.id = c.docente_id
       WHERE c.modulo_id IS NULL AND u.correo_institucional LIKE $1`,
      [DEMO_LIKE],
    );

    expect(route).toEqual([
      { nombre_completo: 'Sofía Marquesina', titulo: 'Ruta de formación GNS' },
    ]);
  });

  it('has unique well-formed codes and no PDF yet (generated on first download)', async () => {
    const certificates = await rows(
      `SELECT c.codigo, c.archivo_id, c.nombre_docente, c.titulo FROM certificado c
       WHERE c.docente_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );

    expect(certificates.length).toBeGreaterThan(0);
    expect(new Set(certificates.map((row) => row.codigo)).size).toBe(certificates.length);
    for (const row of certificates) {
      expect(row.codigo).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
      expect(row.archivo_id).toBeNull();
      expect(String(row.nombre_docente).length).toBeGreaterThan(0);
    }
  });
});

describe('demo shared activities and favorites (BE-5)', () => {
  const DEMO_ACTIVITIES = `(SELECT id FROM actividad_repositorio WHERE autor_id IN ${DEMO_TEACHERS})`;

  it('has a few activities by several demo teachers, levels and areas', async () => {
    const activities = await rows(
      `SELECT autor_id, nivel_id, area_id, titulo, pasos, duracion_min FROM actividad_repositorio
       WHERE autor_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );

    expect(activities.length).toBeGreaterThanOrEqual(3);
    expect(new Set(activities.map((row) => row.autor_id)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(activities.map((row) => row.nivel_id)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(activities.map((row) => row.area_id)).size).toBeGreaterThanOrEqual(3);
    for (const row of activities) {
      expect(String(row.titulo).length).toBeGreaterThan(0);
      expect(String(row.pasos).length).toBeGreaterThan(0);
      expect(Number(row.duracion_min)).toBeGreaterThan(0);
    }
  });

  it('classifies activities by grade, corner and type with the grade in the activity level (FE-2)', async () => {
    const activities = await rows(
      `SELECT a.tipo, a.grado_id, a.rincon, a.nivel_id, g.nivel_id AS nivel_del_grado
       FROM actividad_repositorio a LEFT JOIN grado g ON g.id = a.grado_id
       WHERE a.autor_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );

    expect(activities.some((row) => row.grado_id !== null)).toBe(true);
    expect(activities.some((row) => row.grado_id === null)).toBe(true);
    expect(activities.some((row) => row.rincon !== null)).toBe(true);
    expect(activities.some((row) => row.rincon === null)).toBe(true);
    expect(new Set(activities.map((row) => row.tipo)).size).toBeGreaterThanOrEqual(3);
    for (const row of activities.filter((item) => item.grado_id !== null)) {
      expect(row.nivel_del_grado).toBe(row.nivel_id);
    }
  });

  it('has an activity that matches a demo lesson plan in grade, area and corner (FE-2)', async () => {
    const matches = await rows(
      `SELECT a.id FROM actividad_repositorio a
       JOIN planeacion p ON p.grado_id = a.grado_id AND p.rincon = a.rincon
       JOIN planeacion_area pa ON pa.planeacion_id = p.id AND pa.area_id = a.area_id
       WHERE a.autor_id IN ${DEMO_TEACHERS} AND p.docente_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );

    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('only links to http or https pages and carries no student data', async () => {
    const links = await rows(
      `SELECT enlace FROM actividad_repositorio WHERE autor_id IN ${DEMO_TEACHERS} AND enlace IS NOT NULL`,
      [DEMO_LIKE],
    );

    expect(links.length).toBeGreaterThan(0);
    for (const row of links) {
      expect(String(row.enlace)).toMatch(/^https?:\/\//);
    }
    // El repositorio no tiene columnas de estudiantes: solo texto de la actividad.
    const columns = await rows(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'actividad_repositorio'`,
    );
    expect(columns.map((row) => row.column_name).join(' ')).not.toMatch(/estudiante/);
  });

  it('has favorites among demo teachers and never on their own activities', async () => {
    const favorites = await rows(
      `SELECT f.usuario_id, a.autor_id FROM favorito_actividad f
       JOIN actividad_repositorio a ON a.id = f.actividad_id
       WHERE f.usuario_id IN ${DEMO_TEACHERS} AND f.actividad_id IN ${DEMO_ACTIVITIES}`,
      [DEMO_LIKE],
    );

    expect(favorites.length).toBeGreaterThanOrEqual(3);
    expect(new Set(favorites.map((row) => row.usuario_id)).size).toBeGreaterThanOrEqual(2);
    for (const row of favorites) {
      expect(row.usuario_id).not.toBe(row.autor_id);
    }
  });

  it('is found by the accent-insensitive search used by the API', async () => {
    const found = await rows(
      `SELECT titulo FROM actividad_repositorio
       WHERE translate(titulo, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN') ILIKE $2 AND autor_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE, '%cuento viajero%'],
    );

    expect(found).toHaveLength(1);
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

  it('stores only first names for students, with the shared rule', async () => {
    const notes = await rows(
      `SELECT estudiante_nombre FROM observador_anotacion WHERE docente_id IN ${DEMO_TEACHERS}`,
      [DEMO_LIKE],
    );

    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) {
      expect(isStudentFirstName(String(note.estudiante_nombre))).toBe(true);
    }
  });

  it('keeps student names and free texts out of the demo audit log of journals and observer notes', async () => {
    const hidden = new Set([
      'descripcion',
      'acciones',
      'estudiante_nombre',
      'version_estudiante',
      'estrategias_pedagogicas',
      'seguimiento',
      'texto',
      'comentario',
    ]);
    const entries = await rows(
      `SELECT accion, datos_antes, datos_despues FROM bitacora
       WHERE usuario_id IN (SELECT id FROM usuario WHERE correo_institucional LIKE $1)
         AND (tipo IN ('diario', 'observador') OR accion ILIKE '%observador%' OR accion ILIKE '%diario%')`,
      [DEMO_LIKE],
    );
    const exposed = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value.flatMap(exposed);
      }
      if (value !== null && typeof value === 'object') {
        return Object.entries(value).flatMap(([key, inner]) =>
          hidden.has(key) && inner !== '[oculto]' ? [key] : exposed(inner),
        );
      }
      return [];
    };

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(exposed(entry.datos_antes)).toEqual([]);
      expect(exposed(entry.datos_despues)).toEqual([]);
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
