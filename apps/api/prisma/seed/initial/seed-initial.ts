import { TrainingModuleStatus, UserRole, UserStatus, parseActivityConfig } from '@gns/shared';
import type { Client } from 'pg';
import { insertForId, insertRow } from '../sql.ts';
import type { AdminConfig } from './admin-config.ts';
import { BENEFITS_ACTIVITIES, BENEFITS_MODULE_NUMBER } from './benefits.data.ts';
import { ACADEMIC_PERIOD_NUMBERS, AREAS, GRADES, LEVELS, SCHOOL_YEAR } from './catalogs.data.ts';
import { FAQ_ENTRIES } from './faq.data.ts';
import { GENERAL_PLAN_NAME, INDUCTION_MODULES } from './induction.data.ts';

export interface TableCount {
  inserted: number;
  existing: number;
}
export type SeedSummary = Record<string, TableCount>;

class SeedCounter {
  readonly summary: SeedSummary = {};

  record(table: string, inserted: boolean): void {
    const count = (this.summary[table] ??= { inserted: 0, existing: 0 });
    if (inserted) {
      count.inserted += 1;
    } else {
      count.existing += 1;
    }
  }
}

/** Valida las actividades antes de escribir: un fallo no deja nada a medias. */
function validatedActivities() {
  return BENEFITS_ACTIVITIES.map((activity, index) => {
    const parsed = parseActivityConfig(activity.type, activity.config);
    if (!parsed.success) {
      throw new Error(
        `Actividad inválida (módulo ${BENEFITS_MODULE_NUMBER}, orden ${index + 1}, «${activity.title}»): ${parsed.error.message}`,
      );
    }
    return { ...activity, config: parsed.data };
  });
}

async function idByName(client: Client, table: string, name: string): Promise<string> {
  const result = await client.query<{ id: string }>(`SELECT id FROM ${table} WHERE nombre = $1`, [
    name,
  ]);
  const row = result.rows[0];
  if (!row) {
    throw new Error(`No existe «${name}» en ${table}`);
  }
  return row.id;
}

async function seedCatalogs(client: Client, counter: SeedCounter): Promise<void> {
  for (const level of LEVELS) {
    const row = await insertRow(
      client,
      'nivel',
      { nombre: level.name, orden: level.sortOrder },
      '(nombre)',
    );
    counter.record('nivel', row !== null);
  }
  for (const grade of GRADES) {
    const row = await insertRow(
      client,
      'grado',
      {
        nivel_id: await idByName(client, 'nivel', grade.levelName),
        nombre: grade.name,
        orden: grade.sortOrder,
      },
      '(nombre)',
    );
    counter.record('grado', row !== null);
  }
  for (const area of AREAS) {
    const row = await insertRow(client, 'area', { nombre: area.name, tipo: area.type }, '(nombre)');
    counter.record('area', row !== null);
  }
  for (const number of ACADEMIC_PERIOD_NUMBERS) {
    const row = await insertRow(
      client,
      'periodo_academico',
      { anio_lectivo: SCHOOL_YEAR, numero: number },
      '(anio_lectivo, numero)',
    );
    counter.record('periodo_academico', row !== null);
  }
}

async function countExistingPlanRows(
  client: Client,
  planId: string,
  counter: SeedCounter,
): Promise<void> {
  const tables: Record<string, string> = {
    modulo_formacion: `SELECT count(*) FROM modulo_formacion WHERE plan_id = $1`,
    diapositiva: `SELECT count(*) FROM diapositiva d JOIN modulo_formacion m ON m.id = d.modulo_id WHERE m.plan_id = $1`,
    pregunta_desafio: `SELECT count(*) FROM pregunta_desafio q JOIN modulo_formacion m ON m.id = q.modulo_id WHERE m.plan_id = $1`,
    opcion_pregunta: `SELECT count(*) FROM opcion_pregunta o JOIN pregunta_desafio q ON q.id = o.pregunta_id JOIN modulo_formacion m ON m.id = q.modulo_id WHERE m.plan_id = $1`,
    actividad_modulo: `SELECT count(*) FROM actividad_modulo a JOIN modulo_formacion m ON m.id = a.modulo_id WHERE m.plan_id = $1`,
  };
  for (const [table, sql] of Object.entries(tables)) {
    const result = await client.query<{ count: string }>(sql, [planId]);
    const existing = Number(result.rows[0]?.count ?? 0);
    counter.summary[table] = { inserted: 0, existing };
  }
}

/**
 * El plan General no tiene llave natural: si ya existe se omite el bloque
 * entero para no resucitar contenido que coordinación editó o retiró.
 */
async function seedGeneralPlan(
  client: Client,
  counter: SeedCounter,
  activities: ReturnType<typeof validatedActivities>,
): Promise<void> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM plan_formacion WHERE area_id IS NULL AND anio_lectivo = $1 LIMIT 1`,
    [SCHOOL_YEAR],
  );
  const existingPlan = existing.rows[0];
  if (existingPlan) {
    counter.record('plan_formacion', false);
    await countExistingPlanRows(client, existingPlan.id, counter);
    return;
  }

  const planId = await insertForId(client, 'plan_formacion', {
    nombre: GENERAL_PLAN_NAME,
    anio_lectivo: SCHOOL_YEAR,
  });
  counter.record('plan_formacion', true);

  const moduleIds = new Map<string, string>();
  for (const module of INDUCTION_MODULES) {
    const moduleId = await insertForId(client, 'modulo_formacion', {
      plan_id: planId,
      parte: module.part,
      numero: module.number,
      orden: module.sortOrder,
      titulo: module.title,
      resumen: module.summary,
      video_url: module.videoUrl,
      estado: TrainingModuleStatus.Active,
    });
    counter.record('modulo_formacion', true);
    moduleIds.set(module.number, moduleId);

    for (const [index, slide] of module.slides.entries()) {
      await insertForId(client, 'diapositiva', {
        modulo_id: moduleId,
        orden: index + 1,
        titulo: slide.title,
        ideas_clave: slide.keyIdeas.join('\n'),
      });
      counter.record('diapositiva', true);
    }

    for (const [index, question] of module.questions.entries()) {
      const questionId = await insertForId(client, 'pregunta_desafio', {
        modulo_id: moduleId,
        orden: index + 1,
        tipo: question.type,
        enunciado: question.prompt,
        retroalimentacion: question.feedback,
        respuesta_vf: question.trueFalseAnswer ?? null,
      });
      counter.record('pregunta_desafio', true);
      for (const [position, option] of (question.options ?? []).entries()) {
        await insertForId(client, 'opcion_pregunta', {
          pregunta_id: questionId,
          texto: option.text,
          es_correcta: option.isCorrect ?? null,
          // Solo las preguntas de ordenar guardan la posición correcta.
          orden_correcto: option.isCorrect === undefined ? position + 1 : null,
        });
        counter.record('opcion_pregunta', true);
      }
    }
  }

  const activityModuleId = moduleIds.get(BENEFITS_MODULE_NUMBER);
  if (!activityModuleId) {
    throw new Error(`No existe el módulo ${BENEFITS_MODULE_NUMBER} para sus actividades`);
  }
  for (const [index, activity] of activities.entries()) {
    await insertForId(client, 'actividad_modulo', {
      modulo_id: activityModuleId,
      tipo: activity.type,
      orden: index + 1,
      titulo: activity.title,
      obligatoria: activity.isRequired,
      estado: TrainingModuleStatus.Active,
      configuracion: activity.config,
    });
    counter.record('actividad_modulo', true);
  }
}

async function seedFaq(client: Client, counter: SeedCounter): Promise<void> {
  for (const entry of FAQ_ENTRIES) {
    const existing = await client.query(`SELECT 1 FROM pregunta_frecuente WHERE pregunta = $1`, [
      entry.question,
    ]);
    if (existing.rowCount) {
      counter.record('pregunta_frecuente', false);
      continue;
    }
    await insertForId(client, 'pregunta_frecuente', {
      categoria: entry.category,
      pregunta: entry.question,
      respuesta: entry.answer,
      palabras_clave: entry.keywords,
      fuente: entry.source,
      activa: true,
    });
    counter.record('pregunta_frecuente', true);
  }
}

/**
 * Carga los datos iniciales de forma idempotente: inserta lo que falta y no
 * toca lo que existe. Debe ejecutarse dentro de una transacción abierta por
 * quien la llama (el bloqueo consultivo es de transacción y la reversa es suya).
 */
export async function seedInitialData(client: Client, admin: AdminConfig): Promise<SeedSummary> {
  const activities = validatedActivities();
  const counter = new SeedCounter();

  // Dos cargas simultáneas no deben duplicar el plan General, que no tiene llave natural.
  await client.query(`SELECT pg_advisory_xact_lock(hashtext('gns_seed_initial'))`);

  await seedCatalogs(client, counter);
  await seedGeneralPlan(client, counter, activities);
  await seedFaq(client, counter);
  const adminRow = await insertRow(
    client,
    'usuario',
    {
      nombre_completo: admin.name,
      correo_institucional: admin.email,
      rol: UserRole.Administrator,
      estado: UserStatus.Active,
    },
    '(correo_institucional)',
  );
  counter.record('usuario', adminRow !== null);

  return counter.summary;
}
