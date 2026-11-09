import { expectSqlError, useTestDatabase } from './support/database';
import {
  insertActivityProgress,
  insertRow,
  insertTrainingActivity,
  insertUser,
} from './support/fixtures';

const db = useTestDatabase();

const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';

describe('actividad_modulo', () => {
  it('accepts a JSON object as configuration', async () => {
    const activity = await insertTrainingActivity(db.client, { configuracion: { pares: [] } });

    expect(activity.configuracion).toEqual({ pares: [] });
  });

  it.each([['[]'], ['"texto"'], ['5'], ['null'], ['true']])(
    'rejects %s as configuration',
    async (json) => {
      await expectSqlError(
        db.client,
        CHECK_VIOLATION,
        `INSERT INTO actividad_modulo (modulo_id, tipo, orden, titulo, obligatoria, estado, configuracion)
         VALUES ($1, 'conecta', 1, 'Actividad', false, 'activo', $2::jsonb)`,
        [(await insertTrainingActivity(db.client)).modulo_id, json],
      );
    },
  );

  it('requires the required flag to be chosen explicitly', async () => {
    const parent = await insertTrainingActivity(db.client);

    await expectSqlError(
      db.client,
      '23502',
      `INSERT INTO actividad_modulo (modulo_id, tipo, orden, titulo, estado, configuracion)
       VALUES ($1, 'conecta', 2, 'Sin obligatoriedad', 'activo', '{}')`,
      [parent.modulo_id],
    );
  });

  it('rejects deleting an activity that has progress', async () => {
    const progress = await insertActivityProgress(db.client);

    await expectSqlError(db.client, '23503', 'DELETE FROM actividad_modulo WHERE id = $1', [
      progress.actividad_id,
    ]);
  });
});

describe('progreso_actividad', () => {
  it('defaults to no attempts and no completion', async () => {
    const progress = await insertActivityProgress(db.client);

    expect(progress).toMatchObject({
      intentos: 0,
      completada_en: null,
      mejor_puntaje: null,
      mejores_puntos: null,
      detalle: null,
    });
  });

  it.each([0, 80, 100])('accepts a best score of %i', async (score) => {
    const progress = await insertActivityProgress(db.client, { mejor_puntaje: score });

    expect(progress.mejor_puntaje).toBe(score);
  });

  it.each([-1, 101])('rejects a best score of %i', async (score) => {
    await expectSqlError(
      db.client,
      CHECK_VIOLATION,
      `INSERT INTO progreso_actividad (docente_id, actividad_id, mejor_puntaje) VALUES ($1, $2, $3)`,
      [(await insertUser(db.client)).id, (await insertTrainingActivity(db.client)).id, score],
    );
  });

  it('rejects negative attempts', async () => {
    await expectSqlError(
      db.client,
      CHECK_VIOLATION,
      `INSERT INTO progreso_actividad (docente_id, actividad_id, intentos) VALUES ($1, $2, -1)`,
      [(await insertUser(db.client)).id, (await insertTrainingActivity(db.client)).id],
    );
  });

  it('rejects a second progress for the same teacher and activity', async () => {
    const first = await insertActivityProgress(db.client);

    await expectSqlError(
      db.client,
      UNIQUE_VIOLATION,
      `INSERT INTO progreso_actividad (docente_id, actividad_id) VALUES ($1, $2)`,
      [first.docente_id, first.actividad_id],
    );
  });

  it('allows the same activity for different teachers', async () => {
    const first = await insertActivityProgress(db.client);
    const other = await insertRow(db.client, 'progreso_actividad', {
      docente_id: (await insertUser(db.client)).id,
      actividad_id: first.actividad_id,
    });

    expect(other.actividad_id).toBe(first.actividad_id);
  });
});
