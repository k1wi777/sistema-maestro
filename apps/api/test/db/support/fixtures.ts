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

/** Cada llamada usa un año lectivo propio para no chocar con el único (año, número). */
export function insertAcademicPeriod(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'periodo_academico', {
    anio_lectivo: uniqueSuffix(),
    numero: 1,
    ...values,
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

export function insertAuditLog(client: Client, values: Values = {}): Promise<Row> {
  return insertRow(client, 'bitacora', {
    rol: 'docente',
    tipo: 'ingreso',
    accion: 'Ingreso de prueba',
    ...values,
  });
}
