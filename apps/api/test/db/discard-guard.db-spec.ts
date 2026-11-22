import { expectSqlError, useTestDatabase } from './support/database';
import {
  insertFieldJournal,
  insertFieldJournalAnnotation,
  insertLessonPlan,
  insertObserverNote,
} from './support/fixtures';

const RAISE_EXCEPTION = 'P0001';

const db = useTestDatabase();

async function count(table: string, id: unknown): Promise<number> {
  const result = await db.client.query<{ total: string }>(
    `SELECT count(*) AS total FROM ${table} WHERE id = $1`,
    [id],
  );
  return Number(result.rows[0]?.total);
}

describe('borrado real solo de borradores nunca enviados (#117)', () => {
  describe('planeacion', () => {
    it('permite borrar un borrador nunca enviado', async () => {
      const plan = await insertLessonPlan(db.client);
      await db.client.query('DELETE FROM planeacion_area WHERE planeacion_id = $1', [plan.id]);
      await db.client.query('DELETE FROM planeacion WHERE id = $1', [plan.id]);
      expect(await count('planeacion', plan.id)).toBe(0);
    });

    it.each(['enviada', 'observaciones', 'revisada', 'anulado'])(
      'rechaza borrar una planeación %s',
      async (estado) => {
        const plan = await insertLessonPlan(db.client, { estado, enviada_en: new Date() });
        const error = await expectSqlError(
          db.client,
          RAISE_EXCEPTION,
          'DELETE FROM planeacion WHERE id = $1',
          [plan.id],
        );
        expect(error.message).toContain('nunca se envió');
        expect(await count('planeacion', plan.id)).toBe(1);
      },
    );

    it('rechaza borrar un borrador que ya se envió alguna vez', async () => {
      const plan = await insertLessonPlan(db.client, { enviada_en: new Date() });
      await expectSqlError(db.client, RAISE_EXCEPTION, 'DELETE FROM planeacion WHERE id = $1', [
        plan.id,
      ]);
    });
  });

  describe('observador_anotacion', () => {
    it('permite borrar un borrador', async () => {
      const note = await insertObserverNote(db.client);
      await db.client.query('DELETE FROM observador_anotacion WHERE id = $1', [note.id]);
      expect(await count('observador_anotacion', note.id)).toBe(0);
    });

    it.each(['enviada', 'observaciones', 'revisada', 'anulado'])(
      'rechaza borrar una anotación %s',
      async (estado) => {
        const note = await insertObserverNote(db.client, { estado });
        await expectSqlError(
          db.client,
          RAISE_EXCEPTION,
          'DELETE FROM observador_anotacion WHERE id = $1',
          [note.id],
        );
        expect(await count('observador_anotacion', note.id)).toBe(1);
      },
    );
  });

  describe('diario de campo', () => {
    it('permite borrar la anotación en borrador y luego el diario en curso', async () => {
      const annotation = await insertFieldJournalAnnotation(db.client);
      await db.client.query('DELETE FROM diario_anotacion WHERE id = $1', [annotation.id]);
      await db.client.query('DELETE FROM diario_campo WHERE id = $1', [annotation.diario_id]);
      expect(await count('diario_anotacion', annotation.id)).toBe(0);
      expect(await count('diario_campo', annotation.diario_id)).toBe(0);
    });

    it.each(['lista', 'observada'])('rechaza borrar una anotación %s', async (estado) => {
      const annotation = await insertFieldJournalAnnotation(db.client, { estado });
      await expectSqlError(
        db.client,
        RAISE_EXCEPTION,
        'DELETE FROM diario_anotacion WHERE id = $1',
        [annotation.id],
      );
    });

    it('rechaza borrar una anotación ya enviada aunque siga en borrador', async () => {
      const annotation = await insertFieldJournalAnnotation(db.client, { enviada: true });
      await expectSqlError(
        db.client,
        RAISE_EXCEPTION,
        'DELETE FROM diario_anotacion WHERE id = $1',
        [annotation.id],
      );
    });

    it.each(['enviado', 'observaciones', 'revisado', 'anulado'])(
      'rechaza borrar la anotación en borrador de un diario %s y el diario mismo',
      async (estado) => {
        const journal = await insertFieldJournal(db.client, { estado, enviado_en: new Date() });
        const annotation = await insertFieldJournalAnnotation(db.client, {
          diario_id: journal.id,
          estado: 'borrador',
        });
        await expectSqlError(
          db.client,
          RAISE_EXCEPTION,
          'DELETE FROM diario_anotacion WHERE id = $1',
          [annotation.id],
        );
        await expectSqlError(db.client, RAISE_EXCEPTION, 'DELETE FROM diario_campo WHERE id = $1', [
          journal.id,
        ]);
        expect(await count('diario_campo', journal.id)).toBe(1);
      },
    );

    it('rechaza borrar un diario en curso que ya tiene fecha de envío', async () => {
      const journal = await insertFieldJournal(db.client, { enviado_en: new Date() });
      await expectSqlError(db.client, RAISE_EXCEPTION, 'DELETE FROM diario_campo WHERE id = $1', [
        journal.id,
      ]);
    });
  });

  it('el rol de la aplicación también queda sujeto a los triggers', async () => {
    const note = await insertObserverNote(db.client, { estado: 'enviada' });
    await db.client.query('SAVEPOINT as_app');
    await db.client.query('SET LOCAL ROLE app_gns');
    await expect(
      db.client.query('DELETE FROM observador_anotacion WHERE id = $1', [note.id]),
    ).rejects.toThrow('Solo se puede borrar una anotación del observador en borrador');
    await db.client.query('ROLLBACK TO SAVEPOINT as_app');
  });
});
