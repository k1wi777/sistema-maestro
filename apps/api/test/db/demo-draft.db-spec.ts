import { TrainingModuleStatus } from '@gns/shared';
import { isDemoLoaded, loadDemoData } from '../../prisma/seed/demo/load-demo.ts';
import { useTestDatabase } from './support/database';

const db = useTestDatabase();

describe('demo data and draft modules (R16)', () => {
  // Los datos demo no se pueden borrar: estas pruebas solo son posibles sobre una
  // base donde aún no se hayan cargado (la CI y las bases efímeras).
  it('does not generate progress on an extra module in draft', async () => {
    if (await isDemoLoaded(db.client)) {
      return;
    }
    await db.client.query(
      `INSERT INTO modulo_formacion (plan_id, numero, orden, titulo, estado, video_url)
       SELECT plan_id, '9', 9, 'Módulo en borrador', $1, 'https://youtu.be/borrador'
       FROM modulo_formacion WHERE numero = '0' LIMIT 1`,
      [TrainingModuleStatus.Draft],
    );

    await loadDemoData(db.client);

    const draftProgress = await db.client.query(
      `SELECT 1 FROM progreso_modulo p JOIN modulo_formacion m ON m.id = p.modulo_id
       WHERE m.estado = $1`,
      [TrainingModuleStatus.Draft],
    );
    expect(draftProgress.rowCount).toBe(0);
  });

  it('refuses to script progress on a module that is in draft', async () => {
    if (await isDemoLoaded(db.client)) {
      return;
    }
    await db.client.query(`UPDATE modulo_formacion SET estado = $1 WHERE numero = '2'`, [
      TrainingModuleStatus.Draft,
    ]);

    await expect(loadDemoData(db.client)).rejects.toThrow(/necesitan el módulo «2»/);
  });
});
