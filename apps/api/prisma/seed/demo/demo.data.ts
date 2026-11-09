import {
  AUDIT_UNKNOWN_ROLE,
  AuditLogType,
  JournalEventType,
  ObserverNoteType,
  RecordStatus,
  ReviewAction,
  ReviewRecordType,
  UserRole,
  UserStatus,
} from '@gns/shared';

// Datos demo: conjunto fijo y determinista para simular el uso real de la
// plataforma. Todo es inventado: ningún nombre corresponde a una persona real,
// los correos usan el dominio reservado `.test` (no enrutable) y de los
// estudiantes solo hay el nombre de pila, de una palabra. Los datos dependen de
// los datos iniciales (grados, áreas, periodos y plan General, buscados por nombre).

/** «Demo cargado» = existe un usuario con este dominio. */
export const DEMO_EMAIL_DOMAIN = 'demo.gns.test';

export const DEMO_SCHOOL_YEAR = '2026-2027';

export interface DemoUser {
  key: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

const user = (key: string, name: string, role: UserRole, status: UserStatus = UserStatus.Active) =>
  ({ key, name, email: `${key}@${DEMO_EMAIL_DOMAIN}`, role, status }) satisfies DemoUser;

// Nombres inventados: no sustituir por nombres de personas reales.
export const DEMO_USERS: readonly DemoUser[] = [
  user('elena.ravassa', 'Elena Ravassa', UserRole.Coordinator),
  user('tomas.aldaverde', 'Tomás Aldaverde', UserRole.Coordinator),
  user('valeria.montenueva', 'Valeria Montenueva', UserRole.Teacher),
  user('julian.casaverde', 'Julián Casaverde', UserRole.Teacher),
  user('sofia.marquesina', 'Sofía Marquesina', UserRole.Teacher),
  user('andres.penaverde', 'Andrés Peñaverde', UserRole.Teacher),
  user('daniela.fontalba', 'Daniela Fontalba', UserRole.Teacher),
  user('ricardo.altamora', 'Ricardo Altamora', UserRole.Teacher, UserStatus.Inactive),
];

const COORDINATOR_1 = 'elena.ravassa';
const COORDINATOR_2 = 'tomas.aldaverde';
const VALERIA = 'valeria.montenueva';
const JULIAN = 'julian.casaverde';
const SOFIA = 'sofia.marquesina';
const ANDRES = 'andres.penaverde';
const DANIELA = 'daniela.fontalba';
const RICARDO = 'ricardo.altamora';

export interface DemoAssignment {
  teacher: string;
  grade: string;
  area: string;
  isHomeroomTeacher: boolean;
}

const assignment = (teacher: string, grade: string, area: string, isHomeroomTeacher = false) =>
  ({ teacher, grade, area, isHomeroomTeacher }) satisfies DemoAssignment;

export const DEMO_ASSIGNMENTS: readonly DemoAssignment[] = [
  assignment(VALERIA, 'Red', 'Dimensión cognitiva', true),
  assignment(VALERIA, 'Red', 'Dimensión comunicativa'),
  assignment(VALERIA, 'Blue', 'Dimensión socioafectiva'),
  assignment(JULIAN, 'First Grade', 'English (CLIL)'),
  assignment(JULIAN, 'Transition', 'Pre-ciencias', true),
  assignment(SOFIA, '3°', 'Matemáticas', true),
  assignment(SOFIA, '3°', 'Ciencias Naturales'),
  assignment(SOFIA, '4°', 'Matemáticas'),
  assignment(ANDRES, '7°', 'Física', true),
  assignment(ANDRES, '8°', 'Química'),
  assignment(DANIELA, '10°', 'Filosofía', true),
  assignment(DANIELA, '10°', 'Ciencias Económicas y Políticas'),
  assignment(DANIELA, '11°', 'Emprendimiento'),
  assignment(RICARDO, '5°', 'Ciencias Naturales', true),
];

// ---------- Planeaciones ----------

export interface DemoLessonPlan {
  key: string;
  teacher: string;
  grade: string;
  area: string;
  period: number;
  status: RecordStatus;
  submittedAt: string | null;
  dateFrom: string;
  dateTo: string;
  topic: string;
  crossCuttingProject: string | null;
  expectedPerformance: string;
  learningCorner: string | null;
  curiocityStage: string | null;
  resources: string | null;
  reasonableAdjustments: string | null;
  linkedResources: readonly { tool: string; name: string; url: string; moment: number }[];
}

type PlanInput = Pick<
  DemoLessonPlan,
  'key' | 'teacher' | 'grade' | 'area' | 'status' | 'submittedAt' | 'topic'
> &
  Partial<
    Pick<
      DemoLessonPlan,
      | 'crossCuttingProject'
      | 'learningCorner'
      | 'curiocityStage'
      | 'reasonableAdjustments'
      | 'linkedResources'
    >
  >;

const plan = (input: PlanInput): DemoLessonPlan => ({
  period: 1,
  dateFrom: '2026-09-21',
  dateTo: '2026-09-25',
  expectedPerformance: `Participa y explica con sus palabras lo aprendido sobre ${input.topic.toLowerCase()}.`,
  crossCuttingProject: null,
  learningCorner: null,
  curiocityStage: null,
  resources: 'Material concreto, tarjetas ilustradas y hojas de trabajo.',
  reasonableAdjustments: null,
  linkedResources: [],
  ...input,
});

export const DEMO_LESSON_PLANS: readonly DemoLessonPlan[] = [
  plan({
    key: 'pl1',
    teacher: VALERIA,
    grade: 'Red',
    area: 'Dimensión cognitiva',
    status: RecordStatus.Draft,
    submittedAt: null,
    topic: 'Los colores primarios en el Sweet Home',
    learningCorner: 'Sweet Home',
  }),
  plan({
    key: 'pl2',
    teacher: VALERIA,
    grade: 'Red',
    area: 'Dimensión comunicativa',
    status: RecordStatus.Submitted,
    submittedAt: '2026-10-02T15:10:00-05:00',
    topic: 'Cuentos con imágenes',
    learningCorner: 'Lectura e imágenes',
  }),
  plan({
    key: 'pl3',
    teacher: JULIAN,
    grade: 'First Grade',
    area: 'English (CLIL)',
    status: RecordStatus.ChangesRequested,
    submittedAt: '2026-09-28T10:30:00-05:00',
    topic: 'Animals around us',
    crossCuttingProject: 'Ciudad+',
    learningCorner: 'Supermarket',
  }),
  plan({
    key: 'pl4',
    teacher: SOFIA,
    grade: '3°',
    area: 'Matemáticas',
    status: RecordStatus.Reviewed,
    submittedAt: '2026-09-18T09:00:00-05:00',
    topic: 'Fracciones en la tienda escolar',
    crossCuttingProject: 'Ciudad+',
    learningCorner: 'Zona de pensamiento lógico-matemático',
    linkedResources: [
      {
        tool: 'Canva',
        name: 'Presentación de fracciones',
        url: `https://recursos.${DEMO_EMAIL_DOMAIN}/fracciones`,
        moment: 1,
      },
      {
        tool: 'Genially',
        name: 'Juego de la tienda',
        url: `https://recursos.${DEMO_EMAIL_DOMAIN}/tienda`,
        moment: 3,
      },
    ],
  }),
  plan({
    key: 'pl5',
    teacher: SOFIA,
    grade: '3°',
    area: 'Ciencias Naturales',
    status: RecordStatus.Voided,
    submittedAt: '2026-09-14T11:20:00-05:00',
    topic: 'El ciclo del agua',
    crossCuttingProject: 'Ciudad+',
    learningCorner: 'Zona STEAM+H',
  }),
  plan({
    key: 'pl6',
    teacher: ANDRES,
    grade: '7°',
    area: 'Física',
    status: RecordStatus.Reviewed,
    submittedAt: '2026-09-22T14:00:00-05:00',
    topic: 'Movimiento rectilíneo uniforme',
    crossCuttingProject: 'STEAM+H',
    curiocityStage: 'Interactúo',
  }),
  plan({
    key: 'pl7',
    teacher: DANIELA,
    grade: '10°',
    area: 'Filosofía',
    status: RecordStatus.Submitted,
    submittedAt: '2026-10-20T16:45:00-05:00',
    topic: 'El mito de la caverna',
    crossCuttingProject: 'STEAM+H',
    curiocityStage: 'Investigo',
    reasonableAdjustments: 'Lectura guiada en parejas y tiempo adicional para la socialización.',
  }),
  plan({
    key: 'pl8',
    teacher: ANDRES,
    grade: '8°',
    area: 'Química',
    status: RecordStatus.Draft,
    submittedAt: null,
    topic: 'Tabla periódica y propiedades',
    crossCuttingProject: 'STEAM+H',
    curiocityStage: 'Creo',
  }),
  plan({
    key: 'pl9',
    teacher: JULIAN,
    grade: 'Transition',
    area: 'Pre-ciencias',
    status: RecordStatus.Reviewed,
    submittedAt: '2026-10-09T08:15:00-05:00',
    topic: 'Germinación de frijoles',
    crossCuttingProject: 'Ciudad+',
    learningCorner: 'Estación sensorial',
  }),
];

/** Los cuatro momentos de la clase se redactan igual para todas las planeaciones demo. */
export const planMoments = (topic: string) => ({
  exploration: `Pregunta detonante para activar los saberes previos sobre ${topic.toLowerCase()}.`,
  development: 'Trabajo guiado con material concreto y registro de hallazgos en parejas.',
  socialization: 'Cada grupo presenta lo que descubrió y la clase comenta los resultados.',
  closing: 'Reflexión final: qué aprendimos y cómo lo usaremos en la próxima sesión.',
});

// ---------- Diario de campo ----------

export interface DemoJournalEntry {
  date: string;
  lesson: string;
  eventType: JournalEventType;
  students: string;
  description: string;
  actions: string;
  reflection: string;
}

export interface DemoJournal {
  key: string;
  teacher: string;
  grade: string;
  period: number;
  status: RecordStatus;
  submittedAt: string | null;
  entries: readonly DemoJournalEntry[];
}

const entry = (
  date: string,
  lesson: string,
  eventType: JournalEventType,
  students: string,
  description: string,
): DemoJournalEntry => ({
  date,
  lesson,
  eventType,
  students,
  description,
  actions: 'Se conversó con el grupo y se acordó una estrategia para la siguiente sesión.',
  reflection: 'Conviene sostener la rutina y observar cómo evoluciona en las próximas semanas.',
});

export const DEMO_JOURNALS: readonly DemoJournal[] = [
  {
    key: 'j1',
    teacher: VALERIA,
    grade: 'Red',
    period: 1,
    status: RecordStatus.Draft,
    submittedAt: null,
    entries: [
      entry(
        '2026-10-05',
        'Rincón Sweet Home',
        JournalEventType.Group,
        'Samuel, Alma',
        'El grupo organizó la cocina de juguete sin ayuda y se turnó los roles.',
      ),
      entry(
        '2026-10-07',
        'Lectura e imágenes',
        JournalEventType.Positive,
        'Alma',
        'Alma narró el cuento completo mirando solo las imágenes.',
      ),
    ],
  },
  {
    key: 'j2',
    teacher: SOFIA,
    grade: '3°',
    period: 1,
    status: RecordStatus.Submitted,
    submittedAt: '2026-10-16T17:00:00-05:00',
    entries: [
      entry(
        '2026-10-05',
        'Matemáticas',
        JournalEventType.Group,
        'Emiliano, Valentina',
        'La mayoría resolvió las fracciones con material concreto.',
      ),
      entry(
        '2026-10-08',
        'Matemáticas',
        JournalEventType.Positive,
        'Valentina',
        'Explicó a sus compañeros cómo repartir una pizza en partes iguales.',
      ),
      entry(
        '2026-10-12',
        'Ciencias Naturales',
        JournalEventType.ToImprove,
        'Emiliano',
        'Le cuesta terminar las actividades en el tiempo previsto.',
      ),
    ],
  },
  {
    key: 'j3',
    teacher: JULIAN,
    grade: 'First Grade',
    period: 1,
    status: RecordStatus.ChangesRequested,
    submittedAt: '2026-10-14T12:10:00-05:00',
    entries: [
      entry(
        '2026-10-06',
        'English (CLIL)',
        JournalEventType.Group,
        'Isabella, Dante',
        'Cantaron la canción de los animales y repitieron el vocabulario.',
      ),
      entry(
        '2026-10-09',
        'English (CLIL)',
        JournalEventType.ToImprove,
        'Dante',
        'Se distrae durante las rutinas de inicio.',
      ),
    ],
  },
  {
    key: 'j4',
    teacher: ANDRES,
    grade: '7°',
    period: 1,
    status: RecordStatus.Reviewed,
    submittedAt: '2026-10-02T13:30:00-05:00',
    entries: [
      entry(
        '2026-09-22',
        'Física',
        JournalEventType.Group,
        'Thiago, Camila',
        'El laboratorio de movimiento se desarrolló con buena participación.',
      ),
      entry(
        '2026-09-24',
        'Física',
        JournalEventType.Positive,
        'Camila',
        'Propuso una forma más precisa de medir el tiempo.',
      ),
      entry(
        '2026-09-29',
        'Física',
        JournalEventType.ToImprove,
        'Thiago',
        'Entrega tarde los informes de laboratorio.',
      ),
      entry(
        '2026-10-01',
        'Física',
        JournalEventType.Group,
        'Camila, Thiago',
        'Socializaron resultados y compararon sus gráficas.',
      ),
    ],
  },
  {
    key: 'j5',
    teacher: DANIELA,
    grade: '10°',
    period: 1,
    status: RecordStatus.Voided,
    submittedAt: '2026-09-30T15:00:00-05:00',
    entries: [
      entry(
        '2026-09-28',
        'Filosofía',
        JournalEventType.Group,
        'Gael, Renata',
        'Registro anulado: se cargó por error en el grado equivocado.',
      ),
      entry(
        '2026-09-29',
        'Filosofía',
        JournalEventType.Positive,
        'Renata',
        'Participación destacada en el debate sobre la caverna.',
      ),
    ],
  },
];

// ---------- Observador del estudiante ----------

export interface DemoObserverNote {
  key: string;
  teacher: string;
  grade: string;
  studentFirstName: string;
  date: string;
  type: ObserverNoteType;
  status: RecordStatus;
  description: string;
  studentVersion: string | null;
  actions: string | null;
  familyInformed: boolean;
  followUp: string | null;
}

const note = (
  key: string,
  teacher: string,
  grade: string,
  studentFirstName: string,
  type: ObserverNoteType,
  status: RecordStatus,
  description: string,
  familyInformed = false,
): DemoObserverNote => ({
  key,
  teacher,
  grade,
  studentFirstName,
  date: '2026-10-13',
  type,
  status,
  description,
  studentVersion: familyInformed
    ? 'Cuenta que quiere mejorar y que recibió apoyo de su grupo.'
    : null,
  actions: 'Conversación individual y acuerdo de seguimiento en clase.',
  familyInformed,
  followUp: familyInformed ? 'Revisar avances en dos semanas.' : null,
});

export const DEMO_OBSERVER_NOTES: readonly DemoObserverNote[] = [
  note(
    'n1',
    VALERIA,
    'Red',
    'Samuel',
    ObserverNoteType.Positive,
    RecordStatus.Draft,
    'Comparte sus juguetes y ayuda a ordenar el rincón.',
  ),
  note(
    'n2',
    JULIAN,
    'First Grade',
    'Isabella',
    ObserverNoteType.Academic,
    RecordStatus.Submitted,
    'Avanza en vocabulario, pero necesita refuerzo en la lectura.',
  ),
  note(
    'n3',
    SOFIA,
    '3°',
    'Emiliano',
    ObserverNoteType.TypeI,
    RecordStatus.ChangesRequested,
    'Empujó a un compañero durante el descanso; se resolvió con diálogo.',
    true,
  ),
  note(
    'n4',
    SOFIA,
    '4°',
    'Valentina',
    ObserverNoteType.TypeII,
    RecordStatus.Reviewed,
    'Burlas repetidas hacia una compañera en el aula; se activó la ruta de convivencia.',
    true,
  ),
  note(
    'n5',
    ANDRES,
    '7°',
    'Thiago',
    ObserverNoteType.TypeIII,
    RecordStatus.Submitted,
    'Situación que requiere acompañamiento de coordinación y orientación escolar.',
    true,
  ),
  note(
    'n6',
    ANDRES,
    '8°',
    'Mariana',
    ObserverNoteType.Other,
    RecordStatus.Voided,
    'Anotación anulada: se registró en el estudiante equivocado.',
  ),
  note(
    'n7',
    DANIELA,
    '10°',
    'Gael',
    ObserverNoteType.Positive,
    RecordStatus.Reviewed,
    'Lidera con respeto el trabajo en equipo y apoya a sus compañeros.',
  ),
  note(
    'n8',
    DANIELA,
    '11°',
    'Renata',
    ObserverNoteType.Academic,
    RecordStatus.ChangesRequested,
    'Entregas incompletas en el proyecto de emprendimiento.',
  ),
];

// ---------- Revisiones de coordinación ----------

export interface DemoReview {
  key: string;
  recordType: ReviewRecordType;
  /** Clave de la planeación, hoja de diario o anotación revisada. */
  recordKey: string;
  reviewer: string;
  action: ReviewAction;
  comment: string;
  adjustedFields: readonly string[];
  date: string;
}

const review = (
  key: string,
  recordType: ReviewRecordType,
  recordKey: string,
  reviewer: string,
  action: ReviewAction,
  date: string,
  comment: string,
  adjustedFields: readonly string[] = [],
): DemoReview => ({ key, recordType, recordKey, reviewer, action, comment, adjustedFields, date });

export const DEMO_REVIEWS: readonly DemoReview[] = [
  review(
    'r1',
    ReviewRecordType.LessonPlan,
    'pl3',
    COORDINATOR_1,
    ReviewAction.ChangesRequested,
    '2026-09-30T09:00:00-05:00',
    'Falta precisar el desempeño esperado y los recursos del momento de desarrollo.',
  ),
  review(
    'r2',
    ReviewRecordType.LessonPlan,
    'pl4',
    COORDINATOR_1,
    ReviewAction.Approved,
    '2026-09-19T10:00:00-05:00',
    'Planeación clara y coherente con el proyecto Ciudad+.',
  ),
  review(
    'r3',
    ReviewRecordType.LessonPlan,
    'pl6',
    COORDINATOR_2,
    ReviewAction.Adjustment,
    '2026-09-23T11:30:00-05:00',
    'Se ajustaron los recursos y el cierre para alinearlos con la etapa Interactúo.',
    ['recursos', 'momento_cierre'],
  ),
  // Todo ajuste va seguido de la decisión que fija el estado del registro (como hace la API).
  review(
    'r11',
    ReviewRecordType.LessonPlan,
    'pl6',
    COORDINATOR_2,
    ReviewAction.Approved,
    '2026-09-23T11:31:00-05:00',
    'Planeación aprobada con los ajustes aplicados.',
  ),
  review(
    'r4',
    ReviewRecordType.LessonPlan,
    'pl9',
    COORDINATOR_2,
    ReviewAction.Approved,
    '2026-10-10T08:45:00-05:00',
    'Excelente uso de la estación sensorial.',
  ),
  review(
    'r5',
    ReviewRecordType.FieldJournal,
    'j3',
    COORDINATOR_1,
    ReviewAction.ChangesRequested,
    '2026-10-15T09:30:00-05:00',
    'Detallar las acciones tomadas frente a la distracción de Dante.',
  ),
  review(
    'r6',
    ReviewRecordType.FieldJournal,
    'j4',
    COORDINATOR_2,
    ReviewAction.Approved,
    '2026-10-03T10:15:00-05:00',
    'Registro completo y con reflexiones útiles.',
  ),
  review(
    'r7',
    ReviewRecordType.ObserverNote,
    'n3',
    COORDINATOR_1,
    ReviewAction.ChangesRequested,
    '2026-10-16T14:00:00-05:00',
    'Añadir la versión del estudiante y el seguimiento acordado.',
  ),
  review(
    'r8',
    ReviewRecordType.ObserverNote,
    'n8',
    COORDINATOR_2,
    ReviewAction.ChangesRequested,
    '2026-10-21T08:20:00-05:00',
    'Concretar las acciones y los plazos del seguimiento.',
  ),
  review(
    'r9',
    ReviewRecordType.ObserverNote,
    'n4',
    COORDINATOR_1,
    ReviewAction.Approved,
    '2026-10-17T15:10:00-05:00',
    'Ruta de convivencia aplicada correctamente.',
  ),
  review(
    'r10',
    ReviewRecordType.ObserverNote,
    'n7',
    COORDINATOR_2,
    ReviewAction.Adjustment,
    '2026-10-22T13:00:00-05:00',
    'Se redactó la descripción en términos objetivos.',
    ['descripcion'],
  ),
  review(
    'r12',
    ReviewRecordType.ObserverNote,
    'n7',
    COORDINATOR_2,
    ReviewAction.Approved,
    '2026-10-22T13:01:00-05:00',
    'Anotación aprobada con la redacción ajustada.',
  ),
];

// ---------- Formación ----------

export interface DemoModuleScript {
  /** Número del módulo (`modulo_formacion.numero`). */
  module: string;
  start: string;
  /** El docente vio el video (si el módulo tiene). */
  watchedVideo: boolean;
  /** El docente vio la presentación (si el módulo tiene diapositivas). */
  watchedPresentation: boolean;
  /** Puntajes de los intentos del Desafío GNS, en orden. */
  attempts: readonly number[];
}

export interface DemoActivityScript {
  title: string;
  at: string;
  attempts: number;
  bestScore: number | null;
  bestPoints: number | null;
  /** Sellos del pasaporte (las primeras N tarjetas); solo en la ruleta. */
  stamps?: number;
  /** Fecha de completado; nula si la actividad no se completó. */
  completedAt: string | null;
}

export interface DemoTeacherTraining {
  teacher: string;
  modules: readonly DemoModuleScript[];
  activities: readonly DemoActivityScript[];
}

const done = (
  module: string,
  start: string,
  attempts: readonly number[] = [92],
): DemoModuleScript => ({
  module,
  start,
  watchedVideo: true,
  watchedPresentation: true,
  attempts,
});

export const DEMO_TRAINING: readonly DemoTeacherTraining[] = [
  {
    // Terminó toda la ruta, incluido el módulo 8.
    teacher: SOFIA,
    modules: [
      done('0', '2026-08-17T08:00:00-05:00'),
      done('1', '2026-08-19T08:00:00-05:00'),
      done('2', '2026-08-24T08:00:00-05:00', [100]),
      done('3', '2026-08-26T08:00:00-05:00', [70, 90]),
      done('4', '2026-08-31T08:00:00-05:00', [86]),
      done('5', '2026-09-02T08:00:00-05:00'),
      done('6', '2026-09-07T08:00:00-05:00', [83]),
      done('7', '2026-09-09T08:00:00-05:00', [100]),
      {
        module: '8',
        start: '2026-09-14T08:00:00-05:00',
        watchedVideo: false,
        watchedPresentation: false,
        attempts: [],
      },
    ],
    activities: [
      {
        title: 'Ruleta de beneficios',
        at: '2026-09-14T08:30:00-05:00',
        attempts: 14,
        bestScore: null,
        bestPoints: null,
        stamps: 14,
        completedAt: '2026-09-14T09:10:00-05:00',
      },
      {
        title: 'Conecta',
        at: '2026-09-14T09:20:00-05:00',
        attempts: 1,
        bestScore: 90,
        bestPoints: 1180,
        completedAt: '2026-09-14T09:20:00-05:00',
      },
      {
        title: '¿Verdad o mito?',
        at: '2026-09-14T09:40:00-05:00',
        attempts: 1,
        bestScore: 80,
        bestPoints: 930,
        completedAt: '2026-09-14T09:40:00-05:00',
      },
      {
        title: 'Simulador de ahorro mutuo',
        at: '2026-09-14T10:00:00-05:00',
        attempts: 1,
        bestScore: null,
        bestPoints: null,
        completedAt: '2026-09-14T10:00:00-05:00',
      },
    ],
  },
  {
    // Terminó los módulos 0 a 7; el 8 está en curso.
    teacher: ANDRES,
    modules: [
      done('0', '2026-09-01T10:00:00-05:00', [84]),
      done('1', '2026-09-03T10:00:00-05:00'),
      done('2', '2026-09-08T10:00:00-05:00'),
      done('3', '2026-09-10T10:00:00-05:00', [95]),
      done('4', '2026-09-15T10:00:00-05:00'),
      done('5', '2026-09-17T10:00:00-05:00', [88]),
      done('6', '2026-09-22T10:00:00-05:00'),
      done('7', '2026-09-24T10:00:00-05:00', [100]),
      {
        module: '8',
        start: '2026-10-06T10:00:00-05:00',
        watchedVideo: false,
        watchedPresentation: false,
        attempts: [],
      },
    ],
    activities: [
      {
        title: 'Ruleta de beneficios',
        at: '2026-10-06T10:30:00-05:00',
        attempts: 5,
        bestScore: null,
        bestPoints: null,
        stamps: 5,
        completedAt: null,
      },
      {
        title: 'Conecta',
        at: '2026-10-06T11:00:00-05:00',
        attempts: 1,
        bestScore: 85,
        bestPoints: 1010,
        completedAt: '2026-10-06T11:00:00-05:00',
      },
      {
        title: '¿Verdad o mito?',
        at: '2026-10-06T11:30:00-05:00',
        attempts: 2,
        bestScore: 60,
        bestPoints: 640,
        completedAt: null,
      },
      {
        title: 'Simulador de bono de desempeño',
        at: '2026-10-06T11:45:00-05:00',
        attempts: 1,
        bestScore: null,
        bestPoints: null,
        completedAt: '2026-10-06T11:45:00-05:00',
      },
    ],
  },
  {
    // Va en el módulo 2; su intento del desafío no alcanzó el 80 %.
    teacher: VALERIA,
    modules: [
      done('0', '2026-10-12T08:00:00-05:00', [90]),
      done('1', '2026-10-14T08:00:00-05:00'),
      {
        module: '2',
        start: '2026-10-19T08:00:00-05:00',
        watchedVideo: true,
        watchedPresentation: false,
        attempts: [60],
      },
    ],
    activities: [
      {
        title: 'Conecta',
        at: '2026-10-20T08:00:00-05:00',
        attempts: 1,
        bestScore: 70,
        bestPoints: 760,
        completedAt: null,
      },
    ],
  },
  {
    // Aprobó el módulo 0 en el segundo intento y apenas empezó el 1.
    teacher: JULIAN,
    modules: [
      done('0', '2026-10-26T14:00:00-05:00', [60, 85]),
      {
        module: '1',
        start: '2026-10-28T14:00:00-05:00',
        watchedVideo: true,
        watchedPresentation: false,
        attempts: [],
      },
    ],
    activities: [],
  },
];

// ---------- Repositorio de actividades ----------

export interface DemoSharedActivity {
  key: string;
  author: string;
  /** Nombre del nivel del catálogo inicial. */
  level: string;
  /** Nombre del área del catálogo inicial; nulo si la actividad no es de un área. */
  area: string | null;
  title: string;
  objective: string;
  durationMinutes: number;
  materials: string;
  steps: string;
  link: string | null;
  createdAt: string;
}

// Actividades ficticias inspiradas en el repositorio del prototipo: de distintos autores,
// niveles y áreas. Sin datos de estudiantes y con enlaces solo a sitios de herramientas conocidas.
export const DEMO_SHARED_ACTIVITIES: readonly DemoSharedActivity[] = [
  {
    key: 'cuento',
    author: VALERIA,
    level: 'Preescolar bajo',
    area: 'Dimensión comunicativa',
    title: 'El cuento viajero',
    objective: 'Contar una historia corta con apoyo de imágenes y respetar los turnos para hablar.',
    durationMinutes: 30,
    materials: 'Cinco láminas ilustradas, un morral de tela y una campana pequeña.',
    steps:
      '1. Sentar al grupo en círculo y mostrar el morral cerrado.\n2. Sacar una lámina y pedir que cada niño diga una frase sobre ella.\n3. Enlazar las frases hasta formar el cuento.\n4. Cerrar tocando la campana y guardar las láminas en el morral.',
    link: null,
    createdAt: '2026-09-08T10:15:00-05:00',
  },
  {
    key: 'flotar',
    author: JULIAN,
    level: 'Preescolar alto (KTF)',
    area: 'Pre-ciencias',
    title: 'Mini laboratorio de flotar y hundir',
    objective: 'Predecir y comprobar qué objetos cotidianos flotan o se hunden en el agua.',
    durationMinutes: 40,
    materials: 'Tres recipientes con agua, tapas, corchos, piedras, monedas y esponjas.',
    steps:
      '1. Mostrar los objetos y pedir una predicción con la mano arriba (flota) o abajo (se hunde).\n2. Probar cada objeto y anotar el resultado en un cartel.\n3. Comparar las predicciones con lo observado.\n4. Conversar sobre qué tienen en común los que flotan.',
    link: null,
    createdAt: '2026-09-15T14:00:00-05:00',
  },
  {
    key: 'tienda',
    author: SOFIA,
    level: 'Primaria',
    area: 'Matemáticas',
    title: 'La tienda del salón: sumas con monedas de cartón',
    objective: 'Resolver sumas y restas con valores de dinero en situaciones de compra y venta.',
    durationMinutes: 50,
    materials: 'Monedas y billetes de cartón, etiquetas de precio y objetos del salón.',
    steps:
      '1. Armar la tienda con objetos del salón y etiquetas de precio.\n2. Por parejas, un vendedor y un comprador resuelven tres compras.\n3. Registrar cada operación en el cuaderno.\n4. Intercambiar los roles y revisar en el tablero una compra de cada pareja.',
    link: 'https://www.canva.com/',
    createdAt: '2026-09-22T09:30:00-05:00',
  },
  {
    key: 'rampas',
    author: ANDRES,
    level: 'Bachillerato',
    area: 'Física',
    title: 'Rampas y fuerzas: ¿qué tan rápido baja?',
    objective: 'Relacionar la inclinación de una rampa con el tiempo de descenso de un carrito.',
    durationMinutes: 60,
    materials: 'Tablas, libros para variar la altura, un carrito, cinta métrica y cronómetro.',
    steps:
      '1. Armar la rampa con tres alturas distintas.\n2. Medir el tiempo de descenso tres veces por altura.\n3. Calcular el promedio y organizarlo en una tabla.\n4. Graficar altura contra tiempo y escribir una conclusión de dos líneas.',
    link: null,
    createdAt: '2026-10-06T08:20:00-05:00',
  },
  {
    key: 'feria',
    author: DANIELA,
    level: 'Bachillerato',
    area: null,
    title: 'Feria de ideas en tres minutos',
    objective: 'Presentar una idea de emprendimiento de forma clara y breve ante el grupo.',
    durationMinutes: 90,
    materials: 'Cronómetro, tarjetas para anotar preguntas y una rúbrica de una página.',
    steps:
      '1. Cada equipo prepara una presentación de tres minutos: problema, idea y a quién ayuda.\n2. Presentar con cronómetro y recibir dos preguntas del grupo.\n3. Votar con tarjetas la idea más clara.\n4. Cerrar con una reflexión sobre lo que se mejoraría.',
    link: 'https://kahoot.com/',
    createdAt: '2026-10-13T11:00:00-05:00',
  },
];

export interface DemoFavorite {
  teacher: string;
  activity: string;
}

/** Algunos favoritos entre docentes demo (ninguno marca una actividad propia). */
export const DEMO_FAVORITES: readonly DemoFavorite[] = [
  { teacher: SOFIA, activity: 'cuento' },
  { teacher: SOFIA, activity: 'flotar' },
  { teacher: SOFIA, activity: 'rampas' },
  { teacher: JULIAN, activity: 'cuento' },
  { teacher: ANDRES, activity: 'tienda' },
  { teacher: VALERIA, activity: 'tienda' },
  { teacher: VALERIA, activity: 'feria' },
];

// ---------- Bitácora ----------

export type DemoEntityRef =
  { kind: 'plan' | 'journal' | 'note' | 'review'; key: string } | { kind: 'module'; key: string };

export interface DemoAuditEntry {
  at: string;
  /** Clave del usuario; nula en el ingreso fallido. */
  user: string | null;
  role: string;
  type: AuditLogType;
  action: string;
  entity?: DemoEntityRef;
  detail?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

const ROLE_OF = Object.fromEntries(DEMO_USERS.map((demoUser) => [demoUser.key, demoUser.role]));

const audit = (
  at: string,
  userKey: string,
  type: AuditLogType,
  action: string,
  entity?: DemoEntityRef,
  extra: Pick<DemoAuditEntry, 'detail' | 'before' | 'after'> = {},
): DemoAuditEntry => ({
  at,
  user: userKey,
  role: ROLE_OF[userKey] ?? UserRole.Teacher,
  type,
  action,
  ...(entity ? { entity } : {}),
  ...extra,
});

const login = (at: string, userKey: string) =>
  audit(at, userKey, AuditLogType.Login, 'Ingresó a la plataforma');

export const DEMO_AUDIT: readonly DemoAuditEntry[] = [
  login('2026-08-17T07:55:00-05:00', SOFIA),
  login('2026-09-01T09:50:00-05:00', ANDRES),
  login('2026-09-18T08:30:00-05:00', COORDINATOR_1),
  login('2026-09-22T13:40:00-05:00', COORDINATOR_2),
  login('2026-10-02T15:00:00-05:00', VALERIA),
  login('2026-10-12T07:58:00-05:00', VALERIA),
  login('2026-10-26T13:55:00-05:00', JULIAN),
  login('2026-10-20T16:40:00-05:00', DANIELA),
  {
    at: '2026-10-21T07:30:00-05:00',
    user: null,
    role: AUDIT_UNKNOWN_ROLE,
    type: AuditLogType.Login,
    action: 'Intento de ingreso fallido',
    detail: 'Credenciales no válidas',
  },
  audit(
    '2026-09-18T09:00:00-05:00',
    SOFIA,
    AuditLogType.LessonPlan,
    'Envió una planeación a coordinación',
    { kind: 'plan', key: 'pl4' },
  ),
  audit(
    '2026-09-22T14:00:00-05:00',
    ANDRES,
    AuditLogType.LessonPlan,
    'Envió una planeación a coordinación',
    { kind: 'plan', key: 'pl6' },
  ),
  audit(
    '2026-09-28T10:30:00-05:00',
    JULIAN,
    AuditLogType.LessonPlan,
    'Envió una planeación a coordinación',
    { kind: 'plan', key: 'pl3' },
  ),
  audit(
    '2026-10-02T15:10:00-05:00',
    VALERIA,
    AuditLogType.LessonPlan,
    'Envió una planeación a coordinación',
    { kind: 'plan', key: 'pl2' },
  ),
  audit(
    '2026-10-09T08:15:00-05:00',
    JULIAN,
    AuditLogType.LessonPlan,
    'Envió una planeación a coordinación',
    { kind: 'plan', key: 'pl9' },
  ),
  audit(
    '2026-10-20T16:45:00-05:00',
    DANIELA,
    AuditLogType.LessonPlan,
    'Envió una planeación a coordinación',
    { kind: 'plan', key: 'pl7' },
  ),
  audit(
    '2026-09-15T11:00:00-05:00',
    SOFIA,
    AuditLogType.LessonPlan,
    'Anuló una planeación',
    { kind: 'plan', key: 'pl5' },
    { detail: 'Duplicada por error' },
  ),
  audit(
    '2026-10-02T13:30:00-05:00',
    ANDRES,
    AuditLogType.FieldJournal,
    'Envió el diario de campo',
    { kind: 'journal', key: 'j4' },
  ),
  audit(
    '2026-10-14T12:10:00-05:00',
    JULIAN,
    AuditLogType.FieldJournal,
    'Envió el diario de campo',
    { kind: 'journal', key: 'j3' },
  ),
  audit('2026-10-16T17:00:00-05:00', SOFIA, AuditLogType.FieldJournal, 'Envió el diario de campo', {
    kind: 'journal',
    key: 'j2',
  }),
  audit(
    '2026-10-13T15:00:00-05:00',
    JULIAN,
    AuditLogType.ObserverNote,
    'Envió una anotación del observador',
    { kind: 'note', key: 'n2' },
  ),
  audit(
    '2026-10-13T15:30:00-05:00',
    ANDRES,
    AuditLogType.ObserverNote,
    'Envió una anotación del observador',
    { kind: 'note', key: 'n5' },
  ),
  audit(
    '2026-08-17T09:30:00-05:00',
    SOFIA,
    AuditLogType.Training,
    'Aprobó el Desafío GNS',
    { kind: 'module', key: '0' },
    { detail: 'Puntaje 92 %' },
  ),
  audit(
    '2026-09-14T09:10:00-05:00',
    SOFIA,
    AuditLogType.Training,
    'Completó el pasaporte de beneficios',
    { kind: 'module', key: '8' },
  ),
  audit(
    '2026-09-14T09:40:00-05:00',
    SOFIA,
    AuditLogType.Training,
    'Terminó un módulo de formación',
    { kind: 'module', key: '8' },
  ),
  audit(
    '2026-09-10T10:50:00-05:00',
    ANDRES,
    AuditLogType.Training,
    'Aprobó el Desafío GNS',
    { kind: 'module', key: '3' },
    { detail: 'Puntaje 95 %' },
  ),
  audit(
    '2026-10-06T11:35:00-05:00',
    ANDRES,
    AuditLogType.Training,
    'No aprobó ¿Verdad o mito?',
    { kind: 'module', key: '8' },
    { detail: 'Puntaje 60 %' },
  ),
  audit(
    '2026-10-19T09:05:00-05:00',
    VALERIA,
    AuditLogType.Training,
    'No aprobó el Desafío GNS',
    { kind: 'module', key: '2' },
    { detail: 'Puntaje 60 %' },
  ),
  audit(
    '2026-10-27T14:50:00-05:00',
    JULIAN,
    AuditLogType.Training,
    'Aprobó el Desafío GNS',
    { kind: 'module', key: '0' },
    { detail: 'Puntaje 85 %' },
  ),
  audit(
    '2026-09-19T10:00:00-05:00',
    COORDINATOR_1,
    AuditLogType.Coordination,
    'Aprobó una planeación',
    { kind: 'review', key: 'r2' },
  ),
  audit(
    '2026-09-23T11:30:00-05:00',
    COORDINATOR_2,
    AuditLogType.Coordination,
    'Ajustó una planeación',
    { kind: 'review', key: 'r3' },
    {
      before: { momento_cierre: 'Reflexión final.' },
      after: { momento_cierre: 'Reflexión final alineada con la etapa Interactúo.' },
    },
  ),
  audit(
    '2026-09-30T09:00:00-05:00',
    COORDINATOR_1,
    AuditLogType.Coordination,
    'Dejó observaciones en una planeación',
    { kind: 'review', key: 'r1' },
  ),
  audit(
    '2026-10-10T08:45:00-05:00',
    COORDINATOR_2,
    AuditLogType.Coordination,
    'Aprobó una planeación',
    { kind: 'review', key: 'r4' },
  ),
  audit(
    '2026-10-03T10:15:00-05:00',
    COORDINATOR_2,
    AuditLogType.Coordination,
    'Aprobó un diario de campo',
    { kind: 'review', key: 'r6' },
  ),
  audit(
    '2026-10-15T09:30:00-05:00',
    COORDINATOR_1,
    AuditLogType.Coordination,
    'Dejó observaciones en un diario de campo',
    { kind: 'review', key: 'r5' },
  ),
  audit(
    '2026-10-17T15:10:00-05:00',
    COORDINATOR_1,
    AuditLogType.Coordination,
    'Aprobó una anotación del observador',
    { kind: 'review', key: 'r9' },
  ),
  audit(
    '2026-10-22T13:00:00-05:00',
    COORDINATOR_2,
    AuditLogType.Coordination,
    'Ajustó una anotación del observador',
    { kind: 'review', key: 'r10' },
    {
      // La bitácora no conserva el texto de las anotaciones: se ve que cambió, no su contenido.
      before: { descripcion: '[oculto]' },
      after: { descripcion: '[oculto]' },
    },
  ),
];
