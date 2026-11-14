import { expectSqlError, useTestDatabase } from './support/database';
import {
  insertCertificate,
  insertStoredFile,
  insertTrainingModule,
  insertUser,
} from './support/fixtures';

const db = useTestDatabase();

const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';
const INSUFFICIENT_PRIVILEGE = '42501';
const APP_ROLE = 'app_gns';

async function hasPrivilege(table: string, privilege: string): Promise<boolean> {
  const result = await db.client.query<{ allowed: boolean }>(
    'SELECT has_table_privilege($1, $2, $3) AS allowed',
    [APP_ROLE, table, privilege],
  );
  return result.rows[0]?.allowed ?? false;
}

describe('archivo', () => {
  it('accepts every purpose and status the API uses', async () => {
    for (const proposito of ['video_modulo', 'presentacion_modulo', 'certificado']) {
      await insertStoredFile(db.client, { proposito });
    }
    for (const estado of ['pendiente', 'disponible', 'rechazado']) {
      await insertStoredFile(db.client, { estado });
    }
  });

  it.each([
    ['an unknown purpose', { proposito: 'otro' }],
    ['an unknown status', { estado: 'archivado' }],
    ['a zero size', { tamano_bytes: 0 }],
    ['a negative size', { tamano_bytes: -5 }],
  ])('rejects %s', async (_name, change) => {
    const values = {
      clave_objeto: 'pruebas/invalida',
      proposito: 'video_modulo',
      tipo_contenido: 'video/mp4',
      tamano_bytes: 10,
      estado: 'pendiente',
      ...change,
    };

    await expectSqlError(
      db.client,
      CHECK_VIOLATION,
      `INSERT INTO archivo (clave_objeto, proposito, tipo_contenido, tamano_bytes, estado)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        values.clave_objeto,
        values.proposito,
        values.tipo_contenido,
        values.tamano_bytes,
        values.estado,
      ],
    );
  });

  it('keeps object keys unique', async () => {
    await insertStoredFile(db.client, { clave_objeto: 'pruebas/misma' });

    await expectSqlError(
      db.client,
      UNIQUE_VIOLATION,
      `INSERT INTO archivo (clave_objeto, proposito, tipo_contenido, tamano_bytes, estado)
       VALUES ('pruebas/misma', 'video_modulo', 'video/mp4', 10, 'pendiente')`,
    );
  });

  it('stores files of any size up to the 500 MB the policy allows', async () => {
    const file = await insertStoredFile(db.client, { tamano_bytes: 500 * 1024 * 1024 });

    expect(BigInt(String(file.tamano_bytes))).toBe(BigInt(500 * 1024 * 1024));
  });
});

describe('modulo_formacion links and files exclude each other (R6)', () => {
  it('rejects a module with a video link and a video file', async () => {
    const file = await insertStoredFile(db.client);

    await expectSqlError(
      db.client,
      CHECK_VIOLATION,
      `INSERT INTO modulo_formacion (plan_id, seccion_id, orden, titulo, estado, video_url, video_archivo_id)
       SELECT plan_id, seccion_id, 5, 'Otro', 'activo', 'https://youtu.be/dQw4w9WgXcQ', $2
       FROM modulo_formacion WHERE id = $1`,
      [(await insertTrainingModule(db.client)).id, file.id],
    );
  });

  it('rejects a module with a presentation link and a presentation file', async () => {
    const module = await insertTrainingModule(db.client);
    const file = await insertStoredFile(db.client, { proposito: 'presentacion_modulo' });

    await expectSqlError(
      db.client,
      CHECK_VIOLATION,
      `UPDATE modulo_formacion SET presentacion_url = 'https://example.com/p.pdf',
         presentacion_archivo_id = $2 WHERE id = $1`,
      [module.id, file.id],
    );
  });

  it('allows a link for one purpose and a file for the other', async () => {
    const file = await insertStoredFile(db.client);
    const module = await insertTrainingModule(db.client, {
      presentacion_url: 'https://example.com/p.pdf',
      video_archivo_id: file.id,
    });

    expect(module).toMatchObject({ video_archivo_id: file.id, video_url: null });
  });
});

describe('certificado', () => {
  it('keeps a single certificate per teacher and module', async () => {
    const teacher = await insertUser(db.client);
    const module = await insertTrainingModule(db.client);
    await insertCertificate(db.client, { docente_id: teacher.id, modulo_id: module.id });

    await expectSqlError(
      db.client,
      UNIQUE_VIOLATION,
      `INSERT INTO certificado (docente_id, modulo_id, codigo, emitido_en, nombre_docente, titulo)
       VALUES ($1, $2, 'OTRO-CODIGO', now(), 'Docente', 'Módulo')`,
      [teacher.id, module.id],
    );
  });

  it('keeps a single route certificate per teacher, but one per module is fine', async () => {
    const teacher = await insertUser(db.client);
    await insertCertificate(db.client, { docente_id: teacher.id, modulo_id: null });
    await insertCertificate(db.client, {
      docente_id: teacher.id,
      modulo_id: (await insertTrainingModule(db.client)).id,
    });
    await insertCertificate(db.client, {
      docente_id: teacher.id,
      modulo_id: (await insertTrainingModule(db.client)).id,
    });

    await expectSqlError(
      db.client,
      UNIQUE_VIOLATION,
      `INSERT INTO certificado (docente_id, modulo_id, codigo, emitido_en, nombre_docente, titulo)
       VALUES ($1, NULL, 'OTRO-CODIGO-2', now(), 'Docente', 'Ruta')`,
      [teacher.id],
    );
  });

  it('keeps verification codes unique', async () => {
    await insertCertificate(db.client, { codigo: 'ABCD-EFGH-JKMN-PQRS' });

    await expectSqlError(
      db.client,
      UNIQUE_VIOLATION,
      `INSERT INTO certificado (docente_id, modulo_id, codigo, emitido_en, nombre_docente, titulo)
       VALUES ($1, NULL, 'ABCD-EFGH-JKMN-PQRS', now(), 'Docente', 'Ruta')`,
      [(await insertUser(db.client)).id],
    );
  });

  it('requires the snapshot of the teacher name and the title', async () => {
    const teacher = await insertUser(db.client);

    await expectSqlError(
      db.client,
      '23502',
      `INSERT INTO certificado (docente_id, codigo, emitido_en) VALUES ($1, 'SIN-INSTANTANEA', now())`,
      [teacher.id],
    );
  });
});

describe(`${APP_ROLE} role on files and certificates (R20)`, () => {
  it.each(['archivo', 'certificado'])(
    'has no DELETE on %s but can read, insert and update',
    async (table) => {
      expect(await hasPrivilege(table, 'DELETE')).toBe(false);
      expect(await hasPrivilege(table, 'TRUNCATE')).toBe(false);
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE']) {
        expect(await hasPrivilege(table, privilege)).toBe(true);
      }
    },
  );

  it.each(['archivo', 'certificado'])(
    'rejects a DELETE on %s made as the application',
    async (table) => {
      await insertStoredFile(db.client);
      await insertCertificate(db.client);
      await db.client.query(`SET LOCAL ROLE ${APP_ROLE}`);

      await expectSqlError(db.client, INSUFFICIENT_PRIVILEGE, `DELETE FROM ${table}`);
    },
  );
});
