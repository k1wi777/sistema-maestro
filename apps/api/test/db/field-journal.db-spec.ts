import { expectSqlError, useTestDatabase } from './support/database';
import {
  insertFieldJournal,
  insertFieldJournalAnnotation,
  insertFieldJournalSubmission,
  insertReview,
  insertRow,
  insertUser,
} from './support/fixtures';

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';
const FOREIGN_KEY_VIOLATION = '23503';
const APP_ROLE = 'app_gns';

const db = useTestDatabase();

async function privilege(table: string, action: string): Promise<boolean> {
  const result = await db.client.query<{ allowed: boolean }>(
    'SELECT has_table_privilege($1, $2, $3) AS allowed',
    [APP_ROLE, table, action],
  );
  return result.rows[0]?.allowed === true;
}

describe('diario de campo colaborativo (#107)', () => {
  it('admite un solo diario por grupo y fecha, y el mismo grupo en otra fecha', async () => {
    const journal = await insertFieldJournal(db.client);

    await expectSqlError(
      db.client,
      UNIQUE_VIOLATION,
      `INSERT INTO diario_campo (grupo_id, fecha, anio_lectivo, estado, creado_por)
       VALUES ($1, $2, $3, 'en_curso', $4)`,
      [journal.grupo_id, journal.fecha, journal.anio_lectivo, journal.creado_por],
    );
    const nextDay = await insertFieldJournal(db.client, {
      grupo_id: journal.grupo_id,
      fecha: '2026-11-10',
      anio_lectivo: journal.anio_lectivo,
    });
    expect(nextDay.id).not.toBe(journal.id);
  });

  it('una anotación lista u observada exige la hora en que se marcó lista', async () => {
    for (const estado of ['lista', 'observada']) {
      await expectSqlError(
        db.client,
        CHECK_VIOLATION,
        `INSERT INTO diario_anotacion (diario_id, docente_id, area_id, tipo_evento, descripcion, estado)
         VALUES ($1, $2, $3, 'grupo', 'Texto', $4)`,
        [
          (await insertFieldJournal(db.client)).id,
          (await insertUser(db.client)).id,
          (
            await insertRow(db.client, 'area', {
              nombre: `Área ${estado}-${Date.now()}`,
              tipo: 'asignatura',
            })
          ).id,
          estado,
        ],
      );
    }
    const draft = await insertFieldJournalAnnotation(db.client, { lista_en: null });
    expect([draft.estado, draft.lista_en, draft.enviada]).toEqual(['borrador', null, false]);
  });

  it('la observación cuelga de una decisión y de una anotación existentes', async () => {
    const annotation = await insertFieldJournalAnnotation(db.client);
    const review = await insertReview(db.client, { tipo_registro: 'diario' });

    const observation = await insertRow(db.client, 'diario_observacion', {
      revision_id: review.id,
      anotacion_id: annotation.id,
      texto: 'Amplía la descripción',
    });
    expect(observation.texto).toBe('Amplía la descripción');
    await expectSqlError(
      db.client,
      FOREIGN_KEY_VIOLATION,
      `INSERT INTO diario_observacion (revision_id, anotacion_id, texto)
       VALUES ($1, $2, 'x')`,
      [review.id, '00000000-0000-4000-8000-000000000000'],
    );
  });

  it('guarda el envío con el n de m y los faltantes sin textos', async () => {
    const submission = await insertFieldJournalSubmission(db.client, {
      faltantes: JSON.stringify([
        { docenteId: '00000000-0000-4000-8000-000000000001', estado: 'borrador' },
      ]),
    });

    expect([submission.aportes_listos, submission.docentes_esperados, submission.reenvio]).toEqual([
      1,
      2,
      false,
    ]);
    expect(submission.faltantes).toEqual([
      { docenteId: '00000000-0000-4000-8000-000000000001', estado: 'borrador' },
    ]);
  });

  it('el archivo de diarios anteriores es de solo lectura para la aplicación', async () => {
    for (const table of ['diario_campo_historico', 'diario_entrada_historico']) {
      expect(await privilege(table, 'SELECT')).toBe(true);
      for (const action of ['INSERT', 'UPDATE', 'DELETE']) {
        expect([table, action, await privilege(table, action)]).toEqual([table, action, false]);
      }
    }
    for (const table of [
      'diario_campo',
      'diario_anotacion',
      'diario_envio',
      'diario_observacion',
    ]) {
      for (const action of ['SELECT', 'INSERT', 'UPDATE']) {
        expect([table, action, await privilege(table, action)]).toEqual([table, action, true]);
      }
    }
  });
});
