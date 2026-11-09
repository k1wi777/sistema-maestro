import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';

// Filas padre mínimas con datos inventados. Todas se crean dentro de la
// transacción de la prueba y desaparecen con su ROLLBACK.

export type Row = Record<string, unknown>;
type Values = Record<string, unknown>;

function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}

/** Inserta una fila y la devuelve. Tablas y columnas vienen del código de las pruebas. */
export async function insertRow(client: Client, table: string, values: Values): Promise<Row> {
  const columns = Object.keys(values);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const sql =
    columns.length === 0
      ? `INSERT INTO ${table} DEFAULT VALUES RETURNING *`
      : `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
  const result = await client.query<Row>(sql, Object.values(values));
  const row = result.rows[0];
  if (!row) {
    throw new Error(`INSERT en ${table} no devolvió ninguna fila`);
  }
  return row;
}

async function idOf(row: Promise<Row>): Promise<string> {
  return String((await row).id);
}

export function insertUser(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'usuario', {
    nombre_completo: 'Docente de Prueba',
    correo_institucional: `prueba-${uniqueSuffix()}@ejemplo.test`,
    rol: 'docente',
    estado: 'activo',
    ...values,
  });
}

export function insertLevel(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'nivel', { nombre: `Nivel ${uniqueSuffix()}`, orden: 1, ...values });
}

export async function insertGrade(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'grado', {
    nivel_id: await idOf(insertLevel(client)),
    nombre: `Grado ${uniqueSuffix()}`,
    orden: 1,
    ...values,
  });
}

export function insertArea(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'area', {
    nombre: `Área ${uniqueSuffix()}`,
    tipo: 'asignatura',
    ...values,
  });
}

/** Año lectivo `AAAA-AAAA` único por llamada (el CHECK exige años consecutivos). */
function uniqueSchoolYear(): string {
  const start = 3000 + Math.floor(Math.random() * 6000);
  return `${start}-${start + 1}`;
}

/** Registra el año lectivo si no existe (periodos y asignaciones lo referencian por código). */
export async function ensureSchoolYear(client: Client, code: string): Promise<void> {
  await client.query(
    'INSERT INTO anio_lectivo (codigo) VALUES ($1) ON CONFLICT (codigo) DO NOTHING',
    [code],
  );
}

export function insertSchoolYear(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'anio_lectivo', { codigo: uniqueSchoolYear(), ...values });
}

/** Cada llamada usa un año lectivo propio para no chocar con el único (año, número). */
export async function insertAcademicPeriod(client: Client, values: Values = {}): Promise<Row> {
  const schoolYear =
    typeof values.anio_lectivo === 'string' ? values.anio_lectivo : uniqueSchoolYear();
  await ensureSchoolYear(client, schoolYear);
  return insertRow(client, 'periodo_academico', { numero: 1, ...values, anio_lectivo: schoolYear });
}

export async function insertTeacherAssignment(client: Client, values: Values = {}): Promise<Row> {
  const schoolYear = typeof values.anio_lectivo === 'string' ? values.anio_lectivo : '2026-2027';
  await ensureSchoolYear(client, schoolYear);
  return insertRow(client, 'asignacion_docente', {
    docente_id: await idOf(insertUser(client)),
    grado_id: await idOf(insertGrade(client)),
    area_id: await idOf(insertArea(client)),
    ...values,
    anio_lectivo: schoolYear,
  });
}

export async function insertLessonPlan(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'planeacion', {
    docente_id: await idOf(insertUser(client)),
    grado_id: await idOf(insertGrade(client)),
    area_id: await idOf(insertArea(client)),
    periodo_id: await idOf(insertAcademicPeriod(client)),
    estado: 'borrador',
    ...values,
  });
}

export async function insertLessonPlanResource(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'recurso_planeacion', {
    planeacion_id: await idOf(insertLessonPlan(client)),
    herramienta: 'Canva',
    url: 'https://recursos.ejemplo.test/uno',
    ...values,
  });
}

export async function insertReview(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'revision', {
    tipo_registro: 'planeacion',
    registro_id: randomUUID(),
    revisor_id: await idOf(insertUser(client, { rol: 'coordinador' })),
    accion: 'aprobada',
    fecha: new Date(),
    ...values,
  });
}

export async function insertFieldJournal(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'diario_campo', {
    docente_id: await idOf(insertUser(client)),
    grado_id: await idOf(insertGrade(client)),
    periodo_id: await idOf(insertAcademicPeriod(client)),
    estado: 'borrador',
    ...values,
  });
}

export async function insertFieldJournalEntry(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'diario_entrada', {
    diario_id: await idOf(insertFieldJournal(client)),
    fecha: '2026-11-08',
    tipo_evento: 'grupo',
    descripcion: 'Evento de prueba',
    ...values,
  });
}

export async function insertObserverNote(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'observador_anotacion', {
    docente_id: await idOf(insertUser(client)),
    grado_id: await idOf(insertGrade(client)),
    estudiante_nombre: 'Lucía',
    fecha: '2026-11-08',
    tipo: 'positiva',
    descripcion: 'Anotación de prueba',
    estado: 'borrador',
    ...values,
  });
}

export function insertTrainingPlan(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'plan_formacion', { nombre: 'Plan de prueba', ...values });
}

export async function insertTrainingModule(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'modulo_formacion', {
    plan_id: await idOf(insertTrainingPlan(client)),
    orden: 1,
    titulo: 'Módulo de prueba',
    estado: 'activo',
    ...values,
  });
}

export async function insertChallengeQuestion(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'pregunta_desafio', {
    modulo_id: await idOf(insertTrainingModule(client)),
    orden: 1,
    tipo: 'opcion',
    enunciado: 'Pregunta de prueba',
    ...values,
  });
}

export async function insertTrainingActivity(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'actividad_modulo', {
    modulo_id: await idOf(insertTrainingModule(client)),
    tipo: 'conecta',
    orden: 1,
    titulo: 'Actividad de prueba',
    obligatoria: false,
    estado: 'activo',
    configuracion: {},
    ...values,
  });
}

export async function insertActivityProgress(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'progreso_actividad', {
    docente_id: await idOf(insertUser(client)),
    actividad_id: await idOf(insertTrainingActivity(client)),
    ...values,
  });
}

export function insertAuditLog(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'bitacora', {
    rol: 'docente',
    tipo: 'ingreso',
    accion: 'Ingreso de prueba',
    ...values,
  });
}

/** Hash de prueba con formato argon2id (no corresponde a ninguna contraseña real). */
export const FAKE_ARGON2ID_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$ZmFrZWhhc2hmYWtlaGFzaGZha2VoYXNo';

export async function insertPasswordCredential(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'credencial_contrasena', {
    usuario_id: await idOf(insertUser(client)),
    hash: FAKE_ARGON2ID_HASH,
    ...values,
  });
}

export async function insertSession(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'sesion', {
    usuario_id: await idOf(insertUser(client)),
    proveedor: 'contrasena',
    renovada_en: new Date(),
    ...values,
  });
}
