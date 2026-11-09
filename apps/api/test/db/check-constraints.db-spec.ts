import {
  AreaType,
  AuditLogType,
  ChallengeQuestionType,
  JournalEventType,
  ObserverNoteType,
  RecordStatus,
  ReviewAction,
  ReviewRecordType,
  CHALLENGE_DEFAULT_APPROVAL_THRESHOLD,
  CHALLENGE_SECONDS_PER_QUESTION_LIMITS,
  TrainingActivityStatus,
  TrainingActivityType,
  TrainingModuleStatus,
  UserRole,
  UserStatus,
} from '@gns/shared';
import type { Client } from 'pg';
import { expectSqlError, useTestDatabase } from './support/database';
import {
  insertAcademicPeriod,
  insertArea,
  insertAuditLog,
  insertChallengeQuestion,
  insertFieldJournal,
  insertFieldJournalEntry,
  insertLessonPlan,
  insertObserverNote,
  insertPasswordCredential,
  insertReview,
  insertSession,
  insertTrainingActivity,
  insertTrainingModule,
  insertUser,
  type Row,
} from './support/fixtures';

const db = useTestDatabase();

const CHECK_VIOLATION = '23514';

interface CheckCase {
  table: string;
  column: string;
  allowed: readonly string[];
  /** Valores ajenos a la lista que la base debe rechazar. */
  rejected: readonly string[];
  insert: (client: Client, values: Record<string, unknown>) => Promise<Row>;
  /** La bitácora no admite UPDATE: su trigger lo rechaza antes que el CHECK. */
  updatable: boolean;
}

const CASES: CheckCase[] = [
  {
    table: 'usuario',
    column: 'rol',
    allowed: Object.values(UserRole),
    rejected: ['estudiante', 'Docente'],
    insert: insertUser,
    updatable: true,
  },
  {
    table: 'usuario',
    column: 'estado',
    allowed: Object.values(UserStatus),
    rejected: ['bloqueado'],
    insert: insertUser,
    updatable: true,
  },
  {
    table: 'area',
    column: 'tipo',
    allowed: Object.values(AreaType),
    rejected: ['dimensión'],
    insert: insertArea,
    updatable: true,
  },
  {
    table: 'planeacion',
    column: 'estado',
    allowed: Object.values(RecordStatus),
    rejected: ['registrada', 'aprobada'],
    insert: insertLessonPlan,
    updatable: true,
  },
  {
    table: 'revision',
    column: 'tipo_registro',
    allowed: Object.values(ReviewRecordType),
    rejected: ['certificado'],
    insert: insertReview,
    updatable: true,
  },
  {
    table: 'revision',
    column: 'accion',
    allowed: Object.values(ReviewAction),
    rejected: ['rechazada'],
    insert: insertReview,
    updatable: true,
  },
  {
    table: 'diario_campo',
    column: 'estado',
    allowed: Object.values(RecordStatus),
    rejected: ['registrada'],
    insert: insertFieldJournal,
    updatable: true,
  },
  {
    table: 'diario_entrada',
    column: 'tipo_evento',
    allowed: Object.values(JournalEventType),
    rejected: ['negativo'],
    insert: insertFieldJournalEntry,
    updatable: true,
  },
  {
    table: 'observador_anotacion',
    column: 'tipo',
    allowed: Object.values(ObserverNoteType),
    rejected: ['tipo_iv', 'académica'],
    insert: insertObserverNote,
    updatable: true,
  },
  {
    // El observador sigue el flujo de la planeación: ya no existe «registrada».
    table: 'observador_anotacion',
    column: 'estado',
    allowed: Object.values(RecordStatus),
    rejected: ['registrada'],
    insert: insertObserverNote,
    updatable: true,
  },
  {
    table: 'modulo_formacion',
    column: 'estado',
    allowed: Object.values(TrainingModuleStatus),
    rejected: ['inactivo'],
    insert: insertTrainingModule,
    updatable: true,
  },
  {
    table: 'actividad_modulo',
    column: 'tipo',
    allowed: Object.values(TrainingActivityType),
    rejected: ['quiz'],
    insert: insertTrainingActivity,
    updatable: true,
  },
  {
    table: 'actividad_modulo',
    column: 'estado',
    // Una actividad no admite `borrador`.
    allowed: Object.values(TrainingActivityStatus),
    rejected: ['inactivo', 'borrador'],
    insert: insertTrainingActivity,
    updatable: true,
  },
  {
    table: 'pregunta_desafio',
    column: 'tipo',
    allowed: Object.values(ChallengeQuestionType),
    rejected: ['abierta'],
    insert: insertChallengeQuestion,
    updatable: true,
  },
  {
    table: 'bitacora',
    column: 'tipo',
    allowed: Object.values(AuditLogType),
    rejected: ['sistema'],
    insert: insertAuditLog,
    updatable: false,
  },
];

/** Valores literales de la definición del CHECK, p. ej. CHECK (rol IN ('docente', …)). */
async function checkConstraintValues(table: string, column: string): Promise<string[]> {
  const result = await db.client.query<{ definition: string }>(
    `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
     WHERE contype = 'c' AND conrelid = $1::regclass AND conname = $2`,
    [table, `${table}_${column}_check`],
  );
  const definition = result.rows[0]?.definition ?? '';
  return [...definition.matchAll(/'([^']*)'/g)].map((match) => match[1] ?? '');
}

describe('check constraints', () => {
  it('declares one named CHECK per constrained column and for the numeric and JSON rules', async () => {
    const result = await db.client.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
       WHERE contype = 'c' AND connamespace = 'public'::regnamespace ORDER BY conname`,
    );

    expect(result.rows.map((row) => row.conname)).toEqual(
      [
        ...CASES.map(({ table, column }) => `${table}_${column}_check`),
        'actividad_modulo_configuracion_check',
        'credencial_contrasena_hash_check',
        'sesion_expira_en_check',
        'sesion_generacion_check',
        'sesion_motivo_revocacion_check',
        'sesion_proveedor_check',
        'sesion_revocacion_check',
        'modulo_formacion_segundos_por_pregunta_check',
        'modulo_formacion_umbral_aprobacion_check',
        'periodo_academico_numero_check',
        'progreso_actividad_intentos_check',
        'progreso_actividad_mejor_puntaje_check',
      ].sort(),
    );
  });

  describe.each(CASES)(
    '$table.$column',
    ({ table, column, allowed, rejected, insert, updatable }) => {
      it('allows exactly the values shared with @gns/shared', async () => {
        expect((await checkConstraintValues(table, column)).sort()).toEqual([...allowed].sort());
      });

      it.each(allowed)('accepts %s', async (value) => {
        const row = await insert(db.client, { [column]: value });

        expect(row[column]).toBe(value);
      });

      it.each(rejected)('rejects %s on insert', async (value) => {
        await db.client.query('SAVEPOINT parents');
        // El fallo aborta la transacción: se vuelve al SAVEPOINT junto con las filas padre.
        await expect(insert(db.client, { [column]: value })).rejects.toMatchObject({
          code: CHECK_VIOLATION,
        });
        await db.client.query('ROLLBACK TO SAVEPOINT parents');
      });

      if (updatable) {
        it('rejects a disallowed value on update', async () => {
          const row = await insert(db.client, {});

          await expectSqlError(
            db.client,
            CHECK_VIOLATION,
            `UPDATE ${table} SET ${column} = $1 WHERE id = $2`,
            [rejected[0], row.id],
          );
        });
      }
    },
  );

  describe('modulo_formacion.estado borrador', () => {
    it('accepts a draft module while activities keep their two statuses', async () => {
      const draft = await insertTrainingModule(db.client, { estado: TrainingModuleStatus.Draft });

      expect(draft.estado).toBe('borrador');
      expect(Object.values(TrainingActivityStatus)).not.toContain('borrador');
    });
  });

  describe('modulo_formacion.umbral_aprobacion', () => {
    it.each([0, 80, 100])('accepts %i', async (value) => {
      const module = await insertTrainingModule(db.client, { umbral_aprobacion: value });

      expect(module.umbral_aprobacion).toBe(value);
    });

    it.each([-1, 101])('rejects %i', async (value) => {
      await expectSqlError(
        db.client,
        CHECK_VIOLATION,
        `UPDATE modulo_formacion SET umbral_aprobacion = $1 WHERE id = $2`,
        [value, (await insertTrainingModule(db.client)).id],
      );
    });

    it('defaults to the shared default', async () => {
      const module = await insertTrainingModule(db.client);

      expect(module.umbral_aprobacion).toBe(CHALLENGE_DEFAULT_APPROVAL_THRESHOLD);
    });
  });

  describe('modulo_formacion.segundos_por_pregunta', () => {
    const { min, max } = CHALLENGE_SECONDS_PER_QUESTION_LIMITS;

    it.each([min, 20, max])('accepts %i', async (value) => {
      const module = await insertTrainingModule(db.client, { segundos_por_pregunta: value });

      expect(module.segundos_por_pregunta).toBe(value);
    });

    it('is null by default', async () => {
      const module = await insertTrainingModule(db.client);

      expect(module.segundos_por_pregunta).toBeNull();
    });

    it.each([0, min - 1, max + 1])('rejects %i', async (value) => {
      await expectSqlError(
        db.client,
        CHECK_VIOLATION,
        `UPDATE modulo_formacion SET segundos_por_pregunta = $1 WHERE id = $2`,
        [value, (await insertTrainingModule(db.client)).id],
      );
    });
  });

  describe('periodo_academico.numero', () => {
    it.each([1, 2, 3])('accepts %i', async (number) => {
      const period = await insertAcademicPeriod(db.client, { numero: number });

      expect(period.numero).toBe(number);
    });

    it.each([0, 4])('rejects %i', async (number) => {
      await expectSqlError(
        db.client,
        CHECK_VIOLATION,
        `INSERT INTO periodo_academico (anio_lectivo, numero) VALUES ('2026-2027', $1)`,
        [number],
      );
    });
  });

  describe('credencial_contrasena.hash', () => {
    it('accepts an argon2id hash', async () => {
      const credential = await insertPasswordCredential(db.client);

      expect(String(credential.hash).startsWith('$argon2id$')).toBe(true);
    });

    it.each(['una-contraseña-en-claro', '$argon2i$v=19$m=1,t=1,p=1$c2FsdA$aGFzaA', '$2b$10$abc'])(
      'rejects a value that is not an argon2id hash',
      async (hash) => {
        await expectSqlError(
          db.client,
          CHECK_VIOLATION,
          'INSERT INTO credencial_contrasena (usuario_id, hash) VALUES ($1, $2)',
          [(await insertUser(db.client)).id, hash],
        );
      },
    );

    it('allows only one credential per user', async () => {
      const credential = await insertPasswordCredential(db.client);

      await expectSqlError(
        db.client,
        '23505',
        'INSERT INTO credencial_contrasena (usuario_id, hash) VALUES ($1, $2)',
        [credential.usuario_id, credential.hash],
      );
    });
  });

  describe('sesion', () => {
    it('stores a session with its defaults', async () => {
      const session = await insertSession(db.client);

      expect(session).toMatchObject({
        proveedor: 'contrasena',
        generacion: 0,
        rotada_en: null,
        expira_en: null,
        revocada_en: null,
        motivo_revocacion: null,
      });
    });

    it('rejects an unknown provider', async () => {
      await expectSqlError(
        db.client,
        CHECK_VIOLATION,
        'INSERT INTO sesion (usuario_id, proveedor, renovada_en) VALUES ($1, $2, now())',
        [(await insertUser(db.client)).id, 'google'],
      );
    });

    it('rejects a negative generation', async () => {
      await expectSqlError(
        db.client,
        CHECK_VIOLATION,
        'UPDATE sesion SET generacion = -1 WHERE id = $1',
        [(await insertSession(db.client)).id],
      );
    });

    it('accepts an absolute expiry after creation and rejects one that is not', async () => {
      const session = await insertSession(db.client, {
        expira_en: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      });
      expect(session.expira_en).not.toBeNull();

      await expectSqlError(
        db.client,
        CHECK_VIOLATION,
        "UPDATE sesion SET expira_en = creado_en - interval '1 second' WHERE id = $1",
        [session.id],
      );
    });

    it.each(['cierre', 'desactivacion', 'contrasena', 'reutilizacion'])(
      'accepts the revocation reason %s together with revocada_en',
      async (reason) => {
        const session = await insertSession(db.client, {
          revocada_en: new Date(),
          motivo_revocacion: reason,
        });

        expect(session.motivo_revocacion).toBe(reason);
      },
    );

    it('rejects an unknown revocation reason', async () => {
      await expectSqlError(
        db.client,
        CHECK_VIOLATION,
        'UPDATE sesion SET revocada_en = now(), motivo_revocacion = $2 WHERE id = $1',
        [(await insertSession(db.client)).id, 'otro'],
      );
    });

    it.each([['revocada_en = now()'], ["motivo_revocacion = 'cierre'"]])(
      'rejects revocation and reason out of sync (%s)',
      async (assignment) => {
        await expectSqlError(
          db.client,
          CHECK_VIOLATION,
          `UPDATE sesion SET ${assignment} WHERE id = $1`,
          [(await insertSession(db.client)).id],
        );
      },
    );
  });
});
