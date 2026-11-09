import {
  AreaType,
  AuditLogType,
  ChallengeQuestionType,
  JournalEventType,
  ObserverNoteType,
  RecordStatus,
  ReviewAction,
  ReviewRecordType,
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
  insertReview,
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
  it('declares one named CHECK per constrained column and for the period number', async () => {
    const result = await db.client.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
       WHERE contype = 'c' AND connamespace = 'public'::regnamespace ORDER BY conname`,
    );

    expect(result.rows.map((row) => row.conname)).toEqual(
      [
        ...CASES.map(({ table, column }) => `${table}_${column}_check`),
        'periodo_academico_numero_check',
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
});
