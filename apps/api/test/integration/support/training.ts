import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ChallengeQuestionType, TrainingActivityType } from '@gns/shared';
import { PrismaService } from '../../../src/shared/database/prisma.service';
import type { Planning } from './planning';
import { asUser, createTestUser, signIn, type Cookies, type TestUser } from './session';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export const unique = (): string => randomUUID().slice(0, 8);

/** Pide `path` con las cookies de la sesión (solo el token de acceso). */
export function call(app: INestApplication, cookies: Cookies, method: Method, path: string) {
  return asUser(app, method, path, cookies, 'access');
}

export interface Created {
  id: string;
  [key: string]: unknown;
}

function created(res: { status: number; body: unknown }, expected: number): Created {
  if (res.status !== expected) {
    throw new Error(
      `Se esperaba ${expected} y se recibió ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }
  return res.body as Created;
}

/** Plan de un área para el año vigente de las pruebas (un área nueva por plan: nunca choca). */
export async function createAreaPlan(
  app: INestApplication,
  coord: Cookies,
  planning: Planning,
  areaId: string,
  name = `Plan ${unique()}`,
): Promise<Created> {
  return created(
    await call(app, coord, 'post', '/training-plans').send({
      name,
      areaId,
      schoolYear: planning.year,
    }),
    201,
  );
}

export async function createSection(
  app: INestApplication,
  coord: Cookies,
  planId: string,
  title = `Sección ${unique()}`,
): Promise<Created> {
  return created(
    await call(app, coord, 'post', `/training-plans/${planId}/sections`).send({ title }),
    201,
  );
}

export async function createModule(
  app: INestApplication,
  coord: Cookies,
  sectionId: string,
  body: Record<string, unknown> = {},
): Promise<Created> {
  return created(
    await call(app, coord, 'post', `/training-sections/${sectionId}/modules`).send({
      title: `Módulo ${unique()}`,
      ...body,
    }),
    201,
  );
}

export const OPTION_QUESTION = {
  type: ChallengeQuestionType.MultipleChoice,
  prompt: '¿Cuál es la opción correcta?',
  feedback: 'Era la primera.',
  options: [
    { text: 'La correcta', isCorrect: true },
    { text: 'Una equivocada', isCorrect: false },
    { text: 'Otra equivocada', isCorrect: false },
  ],
};
export const TRUE_FALSE_QUESTION = {
  type: ChallengeQuestionType.TrueFalse,
  prompt: 'El cielo es azul de día.',
  feedback: 'Es verdad.',
  trueFalseAnswer: true,
};
export const ORDERING_QUESTION = {
  type: ChallengeQuestionType.Ordering,
  prompt: 'Ordena los pasos.',
  feedback: null,
  steps: ['Primero', 'Segundo', 'Tercero'],
};

export const WHEEL_CONFIG = {
  insignia: 'Insignia de prueba',
  tarjetas: ['uno', 'dos'].map((clave) => ({
    clave,
    emoji: '🎯',
    titulo_corto: clave,
    titulo: `Tarjeta ${clave}`,
    dato: `Dato ${clave}`,
    hechos: [`Hecho de ${clave}`],
    pregunta: { enunciado: `¿Pregunta ${clave}?`, opciones: ['No', 'Sí', 'Tal vez'], correcta: 1 },
  })),
};
export const MATCH_CONFIG = {
  pares: [
    { concepto: 'Concepto A', dato: 'Dato de A' },
    { concepto: 'Concepto B', dato: 'Dato de B' },
    { concepto: 'Concepto C', dato: 'Dato de C' },
    { concepto: 'Concepto D', dato: 'Dato de D' },
  ],
  pares_por_ronda: 2,
  rondas: 2,
  segundos_por_ronda: 60,
  umbral_aprobacion: 80,
};
export const MYTH_CONFIG = {
  afirmaciones: [
    { texto: 'Afirmación uno', es_verdad: true, explicacion: 'Explicación uno' },
    { texto: 'Afirmación dos', es_verdad: false, explicacion: 'Explicación dos' },
    { texto: 'Afirmación tres', es_verdad: true, explicacion: 'Explicación tres' },
  ],
  por_partida: 3,
  vidas: 2,
  segundos_por_afirmacion: 30,
  umbral_aprobacion: 60,
};
export const SIMULATOR_CONFIG = {
  entradas: [
    {
      clave: 'salario',
      etiqueta: 'Salario',
      tipo: 'moneda',
      min: 0,
      paso: 1000,
      solo_en_pantalla: true,
    },
  ],
  constantes: [{ clave: 'factor', valor: 2 }],
  calculos: [
    {
      clave: 'doble',
      expresion: { op: 'multiplica', args: [{ ref: 'salario' }, { ref: 'factor' }] },
    },
  ],
  resultados: [{ clave: 'doble', etiqueta: 'Doble', formato: 'moneda' }],
  notas: [],
};

export const CONFIG_BY_TYPE = {
  [TrainingActivityType.WheelPassport]: WHEEL_CONFIG,
  [TrainingActivityType.Match]: MATCH_CONFIG,
  [TrainingActivityType.TrueOrMyth]: MYTH_CONFIG,
  [TrainingActivityType.Simulator]: SIMULATOR_CONFIG,
} as const;

export async function addActivity(
  app: INestApplication,
  coord: Cookies,
  moduleId: string,
  type: TrainingActivityType,
  overrides: Record<string, unknown> = {},
): Promise<Created> {
  return created(
    await call(app, coord, 'post', `/training-modules/${moduleId}/activities`).send({
      type,
      title: `Actividad ${type} ${unique()}`,
      isRequired: false,
      config: CONFIG_BY_TYPE[type],
      ...overrides,
    }),
    201,
  );
}

export async function addQuestion(
  app: INestApplication,
  coord: Cookies,
  moduleId: string,
  body: Record<string, unknown> = OPTION_QUESTION,
): Promise<Created> {
  return created(
    await call(app, coord, 'post', `/training-modules/${moduleId}/questions`).send(body),
    201,
  );
}

export async function addSlide(
  app: INestApplication,
  coord: Cookies,
  moduleId: string,
  title = 'Diapositiva',
): Promise<Created> {
  return created(
    await call(app, coord, 'post', `/training-modules/${moduleId}/slides`).send({
      title,
      keyIdeas: 'Idea uno\nIdea dos',
    }),
    201,
  );
}

export async function publish(
  app: INestApplication,
  coord: Cookies,
  moduleId: string,
): Promise<Created> {
  return created(await call(app, coord, 'post', `/training-modules/${moduleId}/publish`), 200);
}

export interface ModuleOptions {
  video?: boolean;
  slides?: number;
  questions?: Record<string, unknown>[];
  activities?: { type: TrainingActivityType; isRequired?: boolean }[];
  approvalThreshold?: number;
  publish?: boolean;
}

/** Módulo con el contenido pedido, publicado salvo `publish: false`. */
export async function buildModule(
  app: INestApplication,
  coord: Cookies,
  sectionId: string,
  options: ModuleOptions = {},
): Promise<Created> {
  const module = await createModule(app, coord, sectionId, {
    videoUrl: options.video ? 'https://youtu.be/prueba' : null,
    approvalThreshold: options.approvalThreshold ?? 80,
  });
  for (let index = 0; index < (options.slides ?? 0); index += 1) {
    await addSlide(app, coord, module.id);
  }
  for (const question of options.questions ?? []) {
    await addQuestion(app, coord, module.id, question);
  }
  for (const activity of options.activities ?? []) {
    await addActivity(app, coord, module.id, activity.type, {
      isRequired: activity.isRequired ?? false,
    });
  }
  if (options.publish ?? true) {
    await publish(app, coord, module.id);
  }
  return module;
}

/** Filas de la bitácora de formación sobre una entidad, en orden. */
export function trainingAudit(app: INestApplication, entityId: string) {
  return app
    .get(PrismaService)
    .auditLog.findMany({ where: { entityId, type: 'formacion' }, orderBy: { id: 'asc' } });
}

/** Acciones de la bitácora de formación del usuario (el docente de la prueba es solo suyo). */
export async function milestonesOf(app: INestApplication, userId: string): Promise<string[]> {
  const rows = await app
    .get(PrismaService)
    .auditLog.findMany({ where: { userId, type: 'formacion' }, orderBy: { id: 'asc' } });
  return rows.map((row) => row.action);
}

/** Respuesta correcta de una pregunta, leída de la base (la API no la entrega antes de responder). */
export async function correctAnswerOf(
  app: INestApplication,
  questionId: string,
): Promise<Record<string, unknown>> {
  const question = await app
    .get(PrismaService)
    .challengeQuestion.findUniqueOrThrow({ where: { id: questionId }, include: { options: true } });
  if (question.type === ChallengeQuestionType.TrueFalse) {
    return { value: question.trueFalseAnswer };
  }
  if (question.type === ChallengeQuestionType.MultipleChoice) {
    return { optionId: question.options.find((option) => option.isCorrect)?.id };
  }
  return {
    optionIds: [...question.options]
      .sort((a, b) => (a.correctPosition ?? 0) - (b.correctPosition ?? 0))
      .map((option) => option.id),
  };
}

/** Una respuesta incorrecta de una pregunta de verdadero o falso o de opción. */
export async function wrongAnswerOf(
  app: INestApplication,
  questionId: string,
): Promise<Record<string, unknown>> {
  const question = await app
    .get(PrismaService)
    .challengeQuestion.findUniqueOrThrow({ where: { id: questionId }, include: { options: true } });
  if (question.type === ChallengeQuestionType.TrueFalse) {
    return { value: !question.trueFalseAnswer };
  }
  if (question.type === ChallengeQuestionType.MultipleChoice) {
    return { optionId: question.options.find((option) => !option.isCorrect)?.id };
  }
  const ordered = [...question.options].sort(
    (a, b) => (a.correctPosition ?? 0) - (b.correctPosition ?? 0),
  );
  return { optionIds: [...ordered].reverse().map((option) => option.id) };
}

/** Recorre en profundidad un JSON y devuelve las claves que coinciden con `pattern`. */
export function keysMatching(value: unknown, pattern: RegExp, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => keysMatching(item, pattern, `${path}[${index}]`));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => [
      ...(pattern.test(key) ? [`${path}.${key}`] : []),
      ...keysMatching(child, pattern, `${path}.${key}`),
    ]);
  }
  return [];
}

/** Claves que delatan una solución, una pareja o una explicación. */
export const SOLUTION_KEYS =
  /^(correcta|isCorrect|es_correcta|orden_correcto|correctPosition|respuesta_vf|trueFalseAnswer|retroalimentacion|feedback|es_verdad|explicacion|explanation|pares|afirmaciones|correctAnswer|isTrue|correctIndex)$/;

export interface Course {
  user: TestUser;
  teacher: Cookies;
  areaId: string;
  plan: Created;
  section: Created;
}

/** Docente con asignación activa en un área nueva y su plan con una sección, listo para llenar. */
export async function setupCourse(
  app: INestApplication,
  planning: Planning,
  coord: Cookies,
): Promise<Course> {
  const { gradeId, areaId } = await planning.gradeAndArea('Primaria');
  const user = await createTestUser(app);
  await planning.assign(user.id, gradeId, areaId);
  const plan = await createAreaPlan(app, coord, planning, areaId);
  return {
    user,
    teacher: await signIn(app, user),
    areaId,
    plan,
    section: await createSection(app, coord, plan.id, 'Sección del curso'),
  };
}

/** Nuevo docente con la misma asignación (mismo grado y área) que el curso. */
export async function addTeacher(
  app: INestApplication,
  planning: Planning,
  course: Course,
): Promise<{ user: TestUser; cookies: Cookies }> {
  const prisma = app.get(PrismaService);
  const assignment = await prisma.teacherAssignment.findFirstOrThrow({
    where: { teacherId: course.user.id, areaId: course.areaId },
  });
  const user = await createTestUser(app);
  await planning.assign(user.id, assignment.gradeId, course.areaId);
  return { user, cookies: await signIn(app, user) };
}
