import {
  parseActivityConfig,
  parseActivityProgressDetail,
  TrainingActivityType,
  type ActivityConfigByType,
} from '@gns/shared';
import type { Client } from 'pg';
import { SCHOOL_YEAR } from '../initial/catalogs.data.ts';
import { insertForId, insertRow, type Row } from '../sql.ts';
import {
  DEMO_ASSIGNMENTS,
  DEMO_AUDIT,
  DEMO_EMAIL_DOMAIN,
  DEMO_FAVORITES,
  DEMO_JOURNALS,
  DEMO_LESSON_PLANS,
  DEMO_OBSERVER_NOTES,
  DEMO_REVIEWS,
  DEMO_SCHOOL_YEAR,
  DEMO_SHARED_ACTIVITIES,
  DEMO_TRAINING,
  DEMO_USERS,
  planMoments,
  type DemoActivityScript,
  type DemoEntityRef,
  type DemoModuleScript,
} from './demo.data.ts';

export type DemoSummary = Record<string, number>;

const MINUTE = 60_000;
const addMinutes = (iso: string, minutes: number): string =>
  new Date(Date.parse(iso) + minutes * MINUTE).toISOString();

const ENTITY_TABLE: Record<DemoEntityRef['kind'], string> = {
  plan: 'planeacion',
  journal: 'diario_campo',
  note: 'observador_anotacion',
  review: 'revision',
  module: 'modulo_formacion',
};

export async function isDemoLoaded(client: Client): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM usuario WHERE correo_institucional LIKE $1 LIMIT 1`,
    [`%@${DEMO_EMAIL_DOMAIN}`],
  );
  return (result.rowCount ?? 0) > 0;
}

interface ModuleFacts {
  id: string;
  number: string;
  hasVideo: boolean;
  hasPresentation: boolean;
  hasQuestions: boolean;
}

interface ActivityFacts {
  id: string;
  type: TrainingActivityType;
  title: string;
  isRequired: boolean;
  moduleNumber: string;
  config: unknown;
}

/** Datos iniciales de los que dependen los datos demo, buscados por nombre. */
async function loadReferences(client: Client) {
  const plan = await client.query<{ id: string }>(
    `SELECT id FROM plan_formacion WHERE area_id IS NULL AND anio_lectivo = $1 LIMIT 1`,
    [SCHOOL_YEAR],
  );
  const periods = await client.query<{ id: string; numero: number }>(
    `SELECT id, numero FROM periodo_academico WHERE anio_lectivo = $1`,
    [DEMO_SCHOOL_YEAR],
  );
  const planId = plan.rows[0]?.id;
  if (!planId || periods.rowCount !== 3) {
    throw new Error(
      'Faltan los datos iniciales (plan General o periodos). Ejecute db:seed antes de cargar los datos demo.',
    );
  }

  const byName = async (table: string): Promise<Map<string, string>> => {
    const result = await client.query<{ id: string; nombre: string }>(
      `SELECT id, nombre FROM ${table}`,
    );
    return new Map(result.rows.map((row) => [row.nombre, row.id]));
  };

  const modules = await client.query<{
    id: string;
    numero: string;
    video_url: string | null;
    presentacion_url: string | null;
    slides: string;
    questions: string;
  }>(
    `SELECT m.id, m.numero, m.video_url, m.presentacion_url,
            (SELECT count(*) FROM diapositiva d WHERE d.modulo_id = m.id) AS slides,
            (SELECT count(*) FROM pregunta_desafio q WHERE q.modulo_id = m.id) AS questions
     FROM modulo_formacion m WHERE m.plan_id = $1 AND m.estado <> 'borrador'`,
    [planId],
  );
  const moduleFacts = new Map<string, ModuleFacts>(
    modules.rows.map((row) => [
      row.numero,
      {
        id: row.id,
        number: row.numero,
        hasVideo: row.video_url !== null,
        hasPresentation: Number(row.slides) > 0 || row.presentacion_url !== null,
        hasQuestions: Number(row.questions) > 0,
      },
    ]),
  );

  const activities = await client.query<{
    id: string;
    tipo: TrainingActivityType;
    titulo: string;
    obligatoria: boolean;
    numero: string;
    configuracion: unknown;
  }>(
    `SELECT a.id, a.tipo, a.titulo, a.obligatoria, m.numero, a.configuracion
     FROM actividad_modulo a JOIN modulo_formacion m ON m.id = a.modulo_id
     WHERE m.plan_id = $1 AND m.estado <> 'borrador' AND a.estado = 'activo'`,
    [planId],
  );
  const activityFacts = new Map<string, ActivityFacts>(
    activities.rows.map((row) => [
      row.titulo,
      {
        id: row.id,
        type: row.tipo,
        title: row.titulo,
        isRequired: row.obligatoria,
        moduleNumber: row.numero,
        config: row.configuracion,
      },
    ]),
  );

  return {
    levels: await byName('nivel'),
    grades: await byName('grado'),
    areas: await byName('area'),
    periods: new Map(periods.rows.map((row) => [String(row.numero), row.id])),
    moduleFacts,
    activityFacts,
  };
}

function required<T>(map: Map<string, T>, key: string, what: string): T {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(
      `Los datos demo necesitan ${what} «${key}», que no existe en los datos iniciales`,
    );
  }
  return value;
}

/** Comprueba que una actividad solo figure completada si cumple su regla (Decisión 3). */
function assertActivityScript(script: DemoActivityScript, activity: ActivityFacts): void {
  const config = activity.config as { umbral_aprobacion?: number; tarjetas?: unknown[] };
  const complete = script.completedAt !== null;
  const coherent =
    activity.type === TrainingActivityType.WheelPassport
      ? complete === (script.stamps === config.tarjetas?.length)
      : activity.type === TrainingActivityType.Simulator
        ? complete
        : complete === (script.bestScore ?? 0) >= (config.umbral_aprobacion ?? 101);
  if (!coherent) {
    throw new Error(`El progreso demo de «${script.title}» no cumple la regla de su tipo`);
  }
}

export async function loadDemoData(client: Client): Promise<DemoSummary> {
  // Se rechaza antes de escribir cualquier fila.
  if (await isDemoLoaded(client)) {
    throw new Error(
      'Los datos demo ya están cargados. Use db:demo:clear para restablecer la base local.',
    );
  }
  const references = await loadReferences(client);
  await client.query(`SELECT pg_advisory_xact_lock(hashtext('gns_seed_demo'))`);

  const summary: DemoSummary = {};
  const insert = async (table: string, values: Row): Promise<string> => {
    summary[table] = (summary[table] ?? 0) + 1;
    return insertForId(client, table, values);
  };
  const ids = new Map<string, string>();
  const idOf = (key: string): string => required(ids, key, 'el registro');

  for (const demoUser of DEMO_USERS) {
    ids.set(
      demoUser.key,
      await insert('usuario', {
        nombre_completo: demoUser.name,
        correo_institucional: demoUser.email,
        rol: demoUser.role,
        estado: demoUser.status,
      }),
    );
  }

  for (const item of DEMO_ASSIGNMENTS) {
    await insert('asignacion_docente', {
      docente_id: idOf(item.teacher),
      grado_id: required(references.grades, item.grade, 'el grado'),
      area_id: required(references.areas, item.area, 'el área'),
      anio_lectivo: DEMO_SCHOOL_YEAR,
      es_director_grupo: item.isHomeroomTeacher,
    });
  }

  for (const item of DEMO_LESSON_PLANS) {
    const moments = planMoments(item.topic);
    const planId = await insert('planeacion', {
      docente_id: idOf(item.teacher),
      grado_id: required(references.grades, item.grade, 'el grado'),
      area_id: required(references.areas, item.area, 'el área'),
      periodo_id: required(references.periods, String(item.period), 'el periodo'),
      fecha_desde: item.dateFrom,
      fecha_hasta: item.dateTo,
      tema: item.topic,
      proyecto_transversal: item.crossCuttingProject,
      desempeno_esperado: item.expectedPerformance,
      rincon: item.learningCorner,
      etapa_curiocity: item.curiocityStage,
      momento_exploracion: moments.exploration,
      momento_desarrollo: moments.development,
      momento_socializacion: moments.socialization,
      momento_cierre: moments.closing,
      recursos: item.resources,
      ajustes_razonables: item.reasonableAdjustments,
      estado: item.status,
      enviada_en: item.submittedAt,
    });
    ids.set(`plan:${item.key}`, planId);
    for (const resource of item.linkedResources) {
      await insert('recurso_planeacion', {
        planeacion_id: planId,
        herramienta: resource.tool,
        nombre: resource.name,
        url: resource.url,
        momento: resource.moment,
      });
    }
  }

  for (const item of DEMO_JOURNALS) {
    const journalId = await insert('diario_campo', {
      docente_id: idOf(item.teacher),
      grado_id: required(references.grades, item.grade, 'el grado'),
      periodo_id: required(references.periods, String(item.period), 'el periodo'),
      estado: item.status,
      enviada_en: item.submittedAt,
    });
    ids.set(`journal:${item.key}`, journalId);
    for (const entry of item.entries) {
      await insert('diario_entrada', {
        diario_id: journalId,
        fecha: entry.date,
        clase: entry.lesson,
        tipo_evento: entry.eventType,
        estudiantes: entry.students,
        descripcion: entry.description,
        acciones: entry.actions,
        reflexion: entry.reflection,
      });
    }
  }

  for (const item of DEMO_OBSERVER_NOTES) {
    ids.set(
      `note:${item.key}`,
      await insert('observador_anotacion', {
        docente_id: idOf(item.teacher),
        grado_id: required(references.grades, item.grade, 'el grado'),
        estudiante_nombre: item.studentFirstName,
        fecha: item.date,
        tipo: item.type,
        descripcion: item.description,
        version_estudiante: item.studentVersion,
        acciones: item.actions,
        familia_informada: item.familyInformed,
        seguimiento: item.followUp,
        estado: item.status,
      }),
    );
  }

  const recordPrefix = { planeacion: 'plan', diario: 'journal', observador: 'note' } as const;
  for (const item of DEMO_REVIEWS) {
    ids.set(
      `review:${item.key}`,
      await insert('revision', {
        tipo_registro: item.recordType,
        registro_id: idOf(`${recordPrefix[item.recordType]}:${item.recordKey}`),
        revisor_id: idOf(item.reviewer),
        accion: item.action,
        comentario: item.comment,
        campos_ajustados: [...item.adjustedFields],
        fecha: item.date,
      }),
    );
  }

  await loadTraining(references, ids, insert);

  for (const item of DEMO_SHARED_ACTIVITIES) {
    ids.set(
      `activity:${item.key}`,
      await insert('actividad_repositorio', {
        autor_id: idOf(item.author),
        nivel_id: required(references.levels, item.level, 'el nivel'),
        area_id: item.area === null ? null : required(references.areas, item.area, 'el área'),
        titulo: item.title,
        objetivo: item.objective,
        duracion_min: item.durationMinutes,
        materiales: item.materials,
        pasos: item.steps,
        enlace: item.link,
        creado_en: item.createdAt,
        actualizado_en: item.createdAt,
      }),
    );
  }
  for (const item of DEMO_FAVORITES) {
    // La tabla no tiene id propio (clave compuesta): se cuenta como las demás.
    summary.favorito_actividad = (summary.favorito_actividad ?? 0) + 1;
    await insertRow(client, 'favorito_actividad', {
      usuario_id: idOf(item.teacher),
      actividad_id: idOf(`activity:${item.activity}`),
    });
  }

  for (const item of DEMO_AUDIT) {
    const entity = item.entity;
    const entityId =
      entity?.kind === 'module'
        ? required(references.moduleFacts, entity.key, 'el módulo').id
        : entity
          ? idOf(`${entity.kind}:${entity.key}`)
          : null;
    await insert('bitacora', {
      fecha_hora: item.at,
      usuario_id: item.user ? idOf(item.user) : null,
      rol: item.role,
      tipo: item.type,
      accion: item.action,
      entidad: entity ? ENTITY_TABLE[entity.kind] : null,
      entidad_id: entityId,
      detalle: item.detail ?? null,
      datos_antes: item.before ?? null,
      datos_despues: item.after ?? null,
    });
  }

  return summary;
}

type References = Awaited<ReturnType<typeof loadReferences>>;
type Insert = (table: string, values: Row) => Promise<string>;

/**
 * Avance en el plan General. `terminado_en` no se escribe a mano: se deriva de
 * la regla de terminación (pasos fijos presentes y todas las actividades
 * obligatorias activas completadas), así que nunca queda un módulo terminado
 * sin cumplirla.
 */
async function loadTraining(
  references: References,
  ids: Map<string, string>,
  insert: Insert,
): Promise<void> {
  for (const training of DEMO_TRAINING) {
    const teacherId = required(ids, training.teacher, 'el usuario');
    const completionByTitle = new Map<string, string | null>();

    for (const script of training.activities) {
      const activity = required(references.activityFacts, script.title, 'la actividad');
      assertActivityScript(script, activity);
      const detail =
        activity.type === TrainingActivityType.WheelPassport
          ? {
              sellos: (activity.config as ActivityConfigByType['ruleta_pasaporte']).tarjetas
                .slice(0, script.stamps ?? 0)
                .map((card) => card.clave),
            }
          : null;
      if (!parseActivityProgressDetail(activity.type, detail, activity.config).success) {
        throw new Error(`El detalle demo de «${script.title}» no cumple su esquema`);
      }
      const config = parseActivityConfig(activity.type, activity.config);
      if (!config.success) {
        throw new Error(`La configuración de «${script.title}» no cumple su esquema`);
      }
      await insert('progreso_actividad', {
        docente_id: teacherId,
        actividad_id: activity.id,
        completada_en: script.completedAt,
        mejor_puntaje: script.bestScore,
        mejores_puntos: script.bestPoints,
        intentos: script.attempts,
        detalle: detail,
      });
      completionByTitle.set(script.title, script.completedAt);
    }

    for (const script of training.modules) {
      await loadModuleProgress(references, script, teacherId, completionByTitle, insert);
    }
  }
}

async function loadModuleProgress(
  references: References,
  script: DemoModuleScript,
  teacherId: string,
  completionByTitle: Map<string, string | null>,
  insert: Insert,
): Promise<void> {
  const facts = required(references.moduleFacts, script.module, 'el módulo');
  if (script.attempts.length > 0 && !facts.hasQuestions) {
    throw new Error(`El módulo ${script.module} no tiene desafío: no admite intentos demo`);
  }
  const videoViewedAt = facts.hasVideo && script.watchedVideo ? addMinutes(script.start, 10) : null;
  const presentationViewedAt =
    facts.hasPresentation && script.watchedPresentation ? addMinutes(script.start, 25) : null;
  const attempts = script.attempts.map((score, index) => ({
    score,
    points: score * 12,
    date: addMinutes(script.start, 40 + 30 * index),
  }));
  const bestScore = attempts.length > 0 ? Math.max(...attempts.map((a) => a.score)) : null;
  const passedAt = attempts.find((attempt) => attempt.score >= 80)?.date ?? null;

  // Regla de terminación: cada condición aplicable aporta el momento en que se cumplió.
  const requiredActivities = [...references.activityFacts.values()].filter(
    (activity) => activity.moduleNumber === script.module && activity.isRequired,
  );
  const conditions: (string | null)[] = [];
  if (facts.hasVideo) conditions.push(videoViewedAt);
  if (facts.hasPresentation) conditions.push(presentationViewedAt);
  if (facts.hasQuestions) conditions.push(passedAt);
  for (const activity of requiredActivities) {
    conditions.push(completionByTitle.get(activity.title) ?? null);
  }
  const moments = conditions
    .filter((moment) => moment !== null)
    .map((moment) => Date.parse(moment));
  const completedAt =
    moments.length === conditions.length
      ? new Date(Math.max(Date.parse(script.start), ...moments)).toISOString()
      : null;

  const progressId = await insert('progreso_modulo', {
    docente_id: teacherId,
    modulo_id: facts.id,
    video_visto_en: videoViewedAt,
    presentacion_vista_en: presentationViewedAt,
    mejor_puntaje: bestScore,
    aprobado_en: passedAt,
    terminado_en: completedAt,
  });
  for (const attempt of attempts) {
    await insert('intento_desafio', {
      progreso_id: progressId,
      puntaje: attempt.score,
      puntos: attempt.points,
      fecha: attempt.date,
    });
  }
}
