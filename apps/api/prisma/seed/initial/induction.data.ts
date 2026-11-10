import { ChallengeQuestionType } from '@gns/shared';

// Generado a partir del prototipo (fuentes del Work Item); editar con cuidado.

export interface QuestionOptionSeed {
  text: string;
  /** Solo en preguntas de opción única. */
  isCorrect?: boolean;
}

export interface ChallengeQuestionSeed {
  type: ChallengeQuestionType;
  prompt: string;
  feedback: string;
  /** Solo en verdadero o falso. */
  trueFalseAnswer?: boolean;
  /** En las de ordenar, la lista está en el orden correcto. */
  options?: readonly QuestionOptionSeed[];
}

export interface SlideSeed {
  title: string;
  keyIdeas: readonly string[];
}

export const TRAINING_SECTIONS = [
  {
    key: 'welcome',
    title: 'Bienvenida',
    subtitle: 'Inducción institucional 2026–2027',
  },
  {
    key: 'part_1',
    title: 'Parte I · Fundamentos y filosofía',
    subtitle: 'Orígenes y bases científicas del modelo, y qué buscamos lograr',
  },
  {
    key: 'part_2',
    title: 'Parte II · La práctica pedagógica',
    subtitle: 'Estructura de nuestra enseñanza y lo que nos hace únicos',
  },
  {
    key: 'part_3',
    title: 'Parte III · Recomendaciones específicas',
    subtitle: 'Orientaciones para preescolar bajo y preescolar alto',
  },
  {
    key: 'part_4',
    title: 'Parte IV · Nuestro talento humano',
    subtitle: 'Propósito, principios, competencias, estructura y condiciones laborales',
  },
] as const;
export type TrainingSectionKey = (typeof TRAINING_SECTIONS)[number]['key'];

export interface TrainingModuleSeed {
  number: string;
  /** Clave de su sección en `TRAINING_SECTIONS`. */
  section: TrainingSectionKey;
  /** Posición dentro de su sección (1..n). */
  sortOrder: number;
  title: string;
  summary: string;
  videoUrl: string | null;
  videoTitle: string;
  slides: readonly SlideSeed[];
  questions: readonly ChallengeQuestionSeed[];
}

export const GENERAL_PLAN_NAME = 'Inducción institucional';

export const INDUCTION_MODULES: readonly TrainingModuleSeed[] = [
  {
    number: '0',
    section: 'welcome',
    sortOrder: 1,
    title: 'Bienvenida institucional GNS',
    summary:
      'Misión, visión, propósito, principios, jornada laboral, beneficios, evaluación de desempeño y políticas institucionales.',
    videoUrl: null,
    videoTitle: 'Video de bienvenida',
    slides: [],
    questions: [
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: '¿Cuál es el propósito institucional de GNS?',
        feedback: 'Nuestro propósito es transformar vidas.',
        options: [
          {
            text: 'Transformar vidas',
            isCorrect: true,
          },
          {
            text: 'Ser el colegio con más estudiantes de Córdoba',
            isCorrect: false,
          },
          {
            text: 'Preparar exclusivamente para pruebas externas',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: "Según la visión, para el año 2027 George's Noble School será…",
        feedback: 'Así lo declara la visión institucional.',
        options: [
          {
            text: 'La primera opción educativa departamental, con reconocimiento global en la innovación pedagógica',
            isCorrect: true,
          },
          {
            text: 'El único colegio bilingüe de Montería',
            isCorrect: false,
          },
          {
            text: 'Una red de colegios en todo el país',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.TrueFalse,
        prompt:
          'Los docentes de tiempo completo de KTF, Primaria y Bachillerato cumplen 44 horas semanales y, una vez por semana, ingresan a las 6:30 a. m. para apoyar la recepción de estudiantes.',
        feedback:
          'Así está definida la jornada laboral docente; preescolar tiene jornada reducida de 35 horas.',
        trueFalseAnswer: true,
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt:
          'Si conoces una situación que quebranta el Código de Conducta, ¿a quién puedes reportarla?',
        feedback:
          'GNS tiene canales de reporte anónimos y confidenciales, entre ellos la Línea ética.',
        options: [
          {
            text: 'A tu jefe inmediato, a cualquier líder de GNS o por la Línea ética',
            isCorrect: true,
          },
          {
            text: 'Solo a tus compañeros de área',
            isCorrect: false,
          },
          {
            text: 'A nadie: se resuelve de forma informal',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.TrueFalse,
        prompt:
          'En 2026–2027 la evaluación de desempeño tiene seguimiento semestral: diciembre de 2026 y junio de 2027.',
        feedback: 'Esas son las etapas de seguimiento de la evaluación de desempeño.',
        trueFalseAnswer: true,
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt:
          '¿Qué documento regula la relación entre el colegio y sus empleados: horarios, deberes, derechos y procedimientos disciplinarios?',
        feedback: 'El RIT establece reglas, deberes, derechos y responsabilidades de ambas partes.',
        options: [
          {
            text: 'El Reglamento Interno de Trabajo (RIT)',
            isCorrect: true,
          },
          {
            text: 'El Manual de Convivencia de estudiantes',
            isCorrect: false,
          },
          {
            text: 'El Plan de estudios',
            isCorrect: false,
          },
        ],
      },
    ],
  },
  {
    number: '1',
    section: 'part_1',
    sortOrder: 1,
    title: 'Antecedente histórico GNS · Marco epistemológico y científico',
    summary: 'Orígenes del colegio y bases científicas de nuestro modelo.',
    videoUrl: 'https://youtu.be/LAj4tbIR0J4',
    videoTitle: 'Video 1 · Antecedente histórico GNS',
    slides: [
      {
        title: "De Pimpones a George's Noble School",
        keyIdeas: [
          '2006 · Nace el Centro de Desarrollo Infantil Pimpones, ante la falta de instituciones especializadas en primera infancia en Montería.',
          'Abril de 2010 · Se crea el colegio Saint George Montería, con Pimpones como socio fundador.',
          'Septiembre de 2011 · Se inaugura la sede de la Cra 6 # 78-70, barrio Sevilla.',
          "Junio de 2017 · «Cambia nuestro nombre, no nuestra esencia»: George's Noble School. Ese año inicia el bachillerato.",
          '2023 · Primera promoción de bachilleres bilingües.',
        ],
      },
      {
        title: 'Marco epistemológico',
        keyIdeas: [
          'Constructivismo: el estudiante construye el conocimiento a partir de sus saberes previos.',
          'Aprendizaje significativo: lo aprendido sirve para resolver problemas reales.',
          'Aportes de la pedagogía conceptual.',
          'Un modelo flexible, coherente, participativo, creativo, crítico y significativo.',
        ],
      },
      {
        title: 'Marco científico: nuestros referentes',
        keyIdeas: [
          'Jean Piaget · etapas del desarrollo cognitivo y juego simbólico.',
          'Lev Vygotsky · zona de desarrollo próximo; el lenguaje media el pensamiento.',
          'Howard Gardner · inteligencias múltiples como rutas de aprendizaje.',
          'Adele Diamond · funciones ejecutivas: atención, control inhibitorio, flexibilidad.',
          'Reggio Emilia · el ambiente como tercer maestro.',
          'Daniel Goleman · inteligencia emocional.',
        ],
      },
      {
        title: 'La neuroeducación como eje',
        keyIdeas: [
          'Atención personalizada desde el neurodesarrollo.',
          'La emoción es detonante neurocognitivo del aprendizaje.',
          'El juego es motor de aprendizaje y la exploración, estrategia base.',
          'Cada aula: emocionalmente segura, estéticamente cuidada y cognitivamente desafiante.',
        ],
      },
      {
        title: 'Para llevar a tu aula',
        keyIdeas: [
          '¿Qué saberes previos activo al iniciar cada clase?',
          '¿Cómo uso el juego y la emoción para conectar a mis estudiantes?',
          '¿Qué andamiajes ofrezco para que cada uno avance en su zona de desarrollo próximo?',
        ],
      },
    ],
    questions: [
      {
        type: ChallengeQuestionType.Ordering,
        prompt: 'Ordena la historia de GNS, de la más antigua a la más reciente.',
        feedback:
          "2006 Pimpones → 2010 Saint George Montería → 2011 sede Sevilla → 2017 George's Noble School.",
        options: [
          {
            text: 'Centro de Desarrollo Infantil Pimpones',
          },
          {
            text: 'Colegio Saint George Montería',
          },
          {
            text: 'Inauguración de la sede del barrio Sevilla',
          },
          {
            text: "George's Noble School",
          },
        ],
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: '¿En qué método constructivista basa GNS su modelo pedagógico?',
        feedback: 'El PEI establece el aprendizaje significativo como base del modelo.',
        options: [
          {
            text: 'Aprendizaje significativo',
            isCorrect: true,
          },
          {
            text: 'Conductismo',
            isCorrect: false,
          },
          {
            text: 'Aprendizaje memorístico',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: '¿Qué referente propone la zona de desarrollo próximo?',
        feedback: 'Vygotsky: la distancia entre lo que el niño hace solo y lo que logra con ayuda.',
        options: [
          {
            text: 'Lev Vygotsky',
            isCorrect: true,
          },
          {
            text: 'Jean Piaget',
            isCorrect: false,
          },
          {
            text: 'Howard Gardner',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.TrueFalse,
        prompt: 'Para el enfoque Reggio Emilia, el ambiente es el tercer maestro.',
        feedback: 'Por eso cuidamos los rincones y los ambientes de aprendizaje.',
        trueFalseAnswer: true,
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: 'El aporte de Adele Diamond al modelo GNS se relaciona con…',
        feedback: 'Diamond estudia las funciones ejecutivas.',
        options: [
          {
            text: 'Las funciones ejecutivas: atención sostenida, control inhibitorio y flexibilidad cognitiva',
            isCorrect: true,
          },
          {
            text: 'Las inteligencias múltiples',
            isCorrect: false,
          },
          {
            text: 'Las etapas de la escritura',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.TrueFalse,
        prompt: 'En el modelo GNS, el estudiante recibe el conocimiento ya elaborado y lo repite.',
        feedback: 'Falso: el estudiante construye el conocimiento desde sus saberes previos.',
        trueFalseAnswer: false,
      },
    ],
  },
  {
    number: '2',
    section: 'part_1',
    sortOrder: 2,
    title: 'Objetivo del modelo GNS',
    summary: 'Qué buscamos lograr con nuestra metodología.',
    videoUrl: 'https://youtu.be/secrhIHAJUE',
    videoTitle: 'Video 2 · Objetivo del modelo GNS',
    slides: [
      {
        title: '¿Qué busca el modelo GNSM?',
        keyIdeas: [
          'Un proceso continuo, dinámico, activo y participativo.',
          'Potencia el desarrollo coherente y armónico del ser humano en su pluridimensionalidad.',
          'Ofrece escenarios para que cada persona desarrolle su máximo potencial.',
        ],
      },
      {
        title: 'Ocho dimensiones del ser humano',
        keyIdeas: [
          'Ética · Espiritual · Cognitiva · Afectiva',
          'Comunicativa · Estética · Corporal · Socio-política',
        ],
      },
      {
        title: 'Para toda la comunidad educativa',
        keyIdeas: [
          'Estudiantes, docentes, familias y directivos.',
          'El objetivo es su realización plena en la sociedad.',
          'Misión: una comunidad pluricultural que incentiva el desarrollo del potencial humano para alcanzar el bienestar individual y aportar valor y soluciones a una sociedad global dinámica.',
        ],
      },
      {
        title: 'Pilares que integra',
        keyIdeas: [
          'Saber, hacer, saber convivir y ser: pilares de la educación colombiana.',
          'Y un elemento más con nuestro modelo bilingüe: la trascendencia.',
        ],
      },
      {
        title: 'Perfil del egresado GNS',
        keyIdeas: [
          'Respetuoso',
          'Comunicador, en español y en inglés',
          'Líder',
          'Con visión emprendedora',
          'Life long learner',
          'Preparado para el hoy y el mañana',
        ],
      },
    ],
    questions: [
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: 'El modelo GNSM se describe como un proceso…',
        feedback: 'Así lo define el modelo pedagógico GNSM.',
        options: [
          {
            text: 'Continuo, dinámico, activo y participativo',
            isCorrect: true,
          },
          {
            text: 'Estático y centrado en el docente',
            isCorrect: false,
          },
          {
            text: 'Basado en exámenes finales',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: '¿Cuál de estas NO es una de las dimensiones del modelo?',
        feedback:
          'Las ocho dimensiones son ética, espiritual, cognitiva, afectiva, comunicativa, estética, corporal y socio-política.',
        options: [
          {
            text: 'Dimensión financiera',
            isCorrect: true,
          },
          {
            text: 'Dimensión estética',
            isCorrect: false,
          },
          {
            text: 'Dimensión socio-política',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.TrueFalse,
        prompt: 'El modelo busca desarrollar el máximo potencial solo de los estudiantes.',
        feedback:
          'Falso: busca el máximo potencial de estudiantes, docentes, familias y directivos.',
        trueFalseAnswer: false,
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt:
          'Además de saber, hacer, saber convivir y ser, el modelo bilingüe GNS le apuesta a…',
        feedback: 'La trascendencia es el elemento adicional del modelo.',
        options: [
          {
            text: 'La trascendencia',
            isCorrect: true,
          },
          {
            text: 'La competencia entre estudiantes',
            isCorrect: false,
          },
          {
            text: 'La memorización',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: 'Un egresado «Comunicador» es quien…',
        feedback: 'Así lo describe el perfil del egresado.',
        options: [
          {
            text: 'Comunica sus ideas de forma asertiva, en español y en inglés, de forma natural',
            isCorrect: true,
          },
          {
            text: 'Habla en público solo cuando se le pide',
            isCorrect: false,
          },
          {
            text: 'Domina únicamente el español',
            isCorrect: false,
          },
        ],
      },
    ],
  },
  {
    number: '3',
    section: 'part_2',
    sortOrder: 1,
    title: 'Propuesta pedagógica',
    summary:
      'Estructura de nuestra enseñanza: Journey Learning, CurioCity, proyectos transversales y CLIL.',
    videoUrl: 'https://youtu.be/0aLrOdXbtzw',
    videoTitle: 'Video 3 · Propuesta pedagógica',
    slides: [
      {
        title: 'Journey Learning: estrategias macro',
        keyIdeas: [
          'Proyectos integrados mensuales',
          'Estaciones rotativas de aprendizaje',
          'Ritualización de rutinas',
          'Cuento motor y narración interactiva',
          'Juego simbólico estructurado',
          'Situaciones problemáticas concretas',
          'Rondas, canciones y juegos tradicionales',
        ],
      },
      {
        title: 'CurioCity: un ciclo para crear',
        keyIdeas: [
          'Investigo · formulo preguntas significativas a partir de un problema real.',
          'Interactúo · analizo, comparo y confronto saberes.',
          'Creo · desarrollo un producto original, ético y funcional.',
          'Presento · socializo mi proceso y mi creación.',
          'La creación es el objetivo final del aprendizaje.',
        ],
      },
      {
        title: 'Proyectos transversales por periodo',
        keyIdeas: [
          'Preescolar alto (KTF) · P1 Ciudad+ · P2 STEAM+H · P3 Emprendimiento Inicial',
          'Primaria · P1 Ciudad+ · P2 STEAM+H · P3 Emprendimiento Escolar',
          'Bachillerato · P1 STEAM+H · P2 Ciudad+ · P3 Emprendimiento Dragon Fire',
          'El año escolar se organiza en tres periodos.',
        ],
      },
      {
        title: 'Bilingüismo CLIL',
        keyIdeas: [
          'El inglés es medio de comunicación para aprender contenidos, no una asignatura aislada.',
          'Rutinas bilingües diarias e input comprensible y visual.',
          'Conexión emocional con el idioma: canciones, cuentos, títeres y juego.',
        ],
      },
      {
        title: 'Evaluación formativa',
        keyIdeas: [
          'Retroalimenta el proceso; no se limita a calificar el resultado.',
          'Cada actividad significativa deja evidencia observable.',
          'Rúbricas, portafolios, autoevaluación y coevaluación.',
        ],
      },
    ],
    questions: [
      {
        type: ChallengeQuestionType.Ordering,
        prompt: 'Ordena las etapas de CurioCity.',
        feedback: 'Investigo → Interactúo → Creo → Presento.',
        options: [
          {
            text: 'Investigo',
          },
          {
            text: 'Interactúo',
          },
          {
            text: 'Creo',
          },
          {
            text: 'Presento',
          },
        ],
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: 'En CurioCity, ¿cuál es el objetivo final del aprendizaje?',
        feedback: 'CurioCity pone el énfasis en la creación.',
        options: [
          {
            text: 'La creación de un producto original, ético y funcional',
            isCorrect: true,
          },
          {
            text: 'Aprobar un examen escrito',
            isCorrect: false,
          },
          {
            text: 'Memorizar la teoría del tema',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: '¿Qué significa trabajar con CLIL en GNS?',
        feedback: 'CLIL integra contenido e idioma.',
        options: [
          {
            text: 'Usar el inglés como medio para aprender contenidos',
            isCorrect: true,
          },
          {
            text: 'Enseñar gramática inglesa en una clase separada',
            isCorrect: false,
          },
          {
            text: 'Traducir cada clase al español',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.TrueFalse,
        prompt:
          'La evaluación formativa en GNS busca retroalimentar el proceso y no solo calificar el resultado.',
        feedback: 'Ese es su objetivo principal.',
        trueFalseAnswer: true,
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: '¿Cuál es el proyecto transversal del periodo 1 en bachillerato?',
        feedback: 'En bachillerato: P1 STEAM+H, P2 Ciudad+, P3 Dragon Fire.',
        options: [
          {
            text: 'STEAM+H',
            isCorrect: true,
          },
          {
            text: 'Ciudad+',
            isCorrect: false,
          },
          {
            text: 'Emprendimiento Dragon Fire',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: '¿Cuál de estas es una estrategia macro de Journey Learning?',
        feedback:
          'Los proyectos mensuales articulan las áreas con enfoque exploratorio y de juego.',
        options: [
          {
            text: 'Proyectos integrados mensuales',
            isCorrect: true,
          },
          {
            text: 'Clases magistrales diarias',
            isCorrect: false,
          },
          {
            text: 'Exámenes semanales de memoria',
            isCorrect: false,
          },
        ],
      },
    ],
  },
  {
    number: '4',
    section: 'part_2',
    sortOrder: 2,
    title: 'Claves y diferenciadores',
    summary: 'Lo que nos hace únicos en el entorno educativo.',
    videoUrl: 'https://youtu.be/0q_7N2KdPyk',
    videoTitle: 'Video 4 · Claves y diferenciadores',
    slides: [
      {
        title: 'Colegio bilingüe, calendario B',
        keyIdeas: [
          'Más del 50% de las asignaturas se desarrollan en inglés.',
          'Clases en inglés desde el primer grado de preescolar, con más horas en cada nivel.',
          'Año escolar de agosto a junio.',
        ],
      },
      {
        title: 'Grupos pequeños y acompañamiento',
        keyIdeas: [
          'Máximo 16 estudiantes en preescolar, 20 en primaria y 25 en bachillerato.',
          'En preescolar: docente titular y auxiliar en cada salón.',
          'Profesionales de música, educación física, terapia ocupacional, fonoaudiología y psicología.',
        ],
      },
      {
        title: 'Rincones de aprendizaje',
        keyIdeas: [
          'Supermarket · pre-matemáticas y habilidades para la vida.',
          'Sweet Home · habilidades socioemocionales, hábitos de independencia y autonomía.',
          'Ciudadela · las dependencias de la ciudad y las competencias ciudadanas.',
        ],
      },
      {
        title: 'Lenguaje positivo e inclusión',
        keyIdeas: [
          'Atención personalizada desde el neurodesarrollo.',
          'Currículo flexible: los mismos objetivos para todos, con diferentes oportunidades de acceder a ellos (Decreto 1421).',
          'Ajustes razonables en ambientes significativos y contextualizados.',
        ],
      },
      {
        title: 'Material propio',
        keyIdeas: [
          'Nuestros docentes desarrollan el material de cada clase.',
          'No se compran libros ni plataformas especiales cada año.',
          'Control Academic es la plataforma institucional.',
        ],
      },
    ],
    questions: [
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: '¿Qué porcentaje de las asignaturas se desarrolla en inglés?',
        feedback: 'Somos un colegio bilingüe: más del 50% de las asignaturas son en inglés.',
        options: [
          {
            text: 'Más del 50%',
            isCorrect: true,
          },
          {
            text: 'Cerca del 20%',
            isCorrect: false,
          },
          {
            text: 'Solo la clase de English',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: '¿Cuál es el máximo de estudiantes por salón en preescolar?',
        feedback: '16 en preescolar, 20 en primaria y 25 en bachillerato.',
        options: [
          {
            text: '16',
            isCorrect: true,
          },
          {
            text: '25',
            isCorrect: false,
          },
          {
            text: '30',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: '¿Qué rincón trabaja las competencias ciudadanas?',
        feedback: 'Ciudadela recrea las dependencias de la ciudad.',
        options: [
          {
            text: 'Ciudadela',
            isCorrect: true,
          },
          {
            text: 'Supermarket',
            isCorrect: false,
          },
          {
            text: 'Sweet Home',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.TrueFalse,
        prompt: 'Las familias de GNS deben comprar libros de texto cada año.',
        feedback: 'Falso: los docentes desarrollan el material de cada clase.',
        trueFalseAnswer: false,
      },
      {
        type: ChallengeQuestionType.TrueFalse,
        prompt:
          'El currículo flexible mantiene los mismos objetivos para todos, pero da diferentes oportunidades de acceder a ellos.',
        feedback: 'Así lo define el Decreto 1421, que orienta nuestros ajustes razonables.',
        trueFalseAnswer: true,
      },
    ],
  },
  {
    number: '5',
    section: 'part_3',
    sortOrder: 1,
    title: 'Recomendaciones para Preescolar Bajo',
    summary: 'Red, Blue, Purple, Green y Garden: niños y niñas de 2 a 4 años.',
    videoUrl: 'https://youtu.be/fbFqeVVZT48',
    videoTitle: 'Video 5 · Recomendaciones Preescolar Bajo',
    slides: [
      {
        title: 'El ciclo de Preescolar Bajo',
        keyIdeas: [
          'Red, Blue, Purple, Green y Garden · de 2 a 4 años.',
          'Consolida el vínculo escuela-familia-niño.',
          'Experiencias secuenciadas en proyectos mensuales interdisciplinarios.',
          'El juego es el motor, la exploración la estrategia base y la emoción el detonante.',
        ],
      },
      {
        title: 'Neuroconstrucción: cinco momentos',
        keyIdeas: [
          '1 · Activación cerebral',
          '2 · Conexión emocional',
          '3 · Entorno inmersivo',
          '4 · Construcción de significado',
          '5 · Co-construcción',
        ],
      },
      {
        title: 'Ambientes de aprendizaje',
        keyIdeas: [
          'Juego simbólico, arte y expresión plástica, lectura e imágenes.',
          'Construcción y lógica, estación sensorial.',
          'Muro del tiempo y emociones; espacios de transición emocional.',
          'Materiales a la altura del niño y etiquetas visuales en dos idiomas.',
        ],
      },
      {
        title: 'Inglés con enfoque CLIL inicial',
        keyIdeas: [
          'Red y Blue · comandos cortos, canciones con gestos, cuentos visuales.',
          'Purple y Green · preguntas cerradas («What color is it?») y respuesta corporal.',
          'Garden · dramatización de rutinas y estructuras fijas («I am…», «I like…»).',
          'Sin presión por la respuesta verbal.',
        ],
      },
      {
        title: 'Evaluación y uso de pantallas',
        keyIdeas: [
          'Rúbricas visuales con pictogramas y caritas.',
          'Portafolio evolutivo, autoevaluación visual y observación focalizada.',
          'Socialización bimestral con las familias, que son coeducadoras.',
          'Pantallas máximo 10 minutos diarios, siempre con acompañamiento.',
        ],
      },
    ],
    questions: [
      {
        type: ChallengeQuestionType.Ordering,
        prompt: 'Ordena los cinco momentos de la Neuroconstrucción.',
        feedback:
          'Activación → Conexión emocional → Entorno inmersivo → Construcción de significado → Co-construcción.',
        options: [
          {
            text: 'Activación cerebral',
          },
          {
            text: 'Conexión emocional',
          },
          {
            text: 'Entorno inmersivo',
          },
          {
            text: 'Construcción de significado',
          },
          {
            text: 'Co-construcción',
          },
        ],
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: '¿Cuánto tiempo máximo de pantallas se recomienda en Preescolar Bajo?',
        feedback: 'Se priorizan las experiencias manipulativas reales.',
        options: [
          {
            text: '10 minutos diarios, siempre con acompañamiento',
            isCorrect: true,
          },
          {
            text: '30 minutos diarios sin acompañamiento',
            isCorrect: false,
          },
          {
            text: 'No hay un límite',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: 'En Red y Blue, el inglés se trabaja principalmente con…',
        feedback: 'Ejemplos: «sit down», «hello», «thank you».',
        options: [
          {
            text: 'Comandos cortos, canciones con gestos y cuentos visuales',
            isCorrect: true,
          },
          {
            text: 'Lecturas largas en inglés',
            isCorrect: false,
          },
          {
            text: 'Ejercicios de gramática escrita',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.TrueFalse,
        prompt: 'En Preescolar Bajo la evaluación se centra en el producto final.',
        feedback:
          'Falso: el foco está en el proceso, la participación y la construcción de sentido.',
        trueFalseAnswer: false,
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: 'En Preescolar Bajo, las familias se consideran…',
        feedback: 'Son portadoras de saberes y acompañantes activas del proceso.',
        options: [
          {
            text: 'Coeducadoras',
            isCorrect: true,
          },
          {
            text: 'Espectadoras del proceso',
            isCorrect: false,
          },
          {
            text: 'Responsables solo de las tareas',
            isCorrect: false,
          },
        ],
      },
    ],
  },
  {
    number: '6',
    section: 'part_3',
    sortOrder: 2,
    title: 'Recomendaciones para Preescolar Alto (KTF)',
    summary: 'Kinder, Transition y First Grade: niños y niñas de 4 a 7 años.',
    videoUrl: 'https://youtu.be/zfzinmmUsJU',
    videoTitle: 'Video 6 · Recomendaciones Preescolar Alto',
    slides: [
      {
        title: 'El ciclo KTF',
        keyIdeas: [
          'Kinder, Transition y First Grade · de 4 a 7 años.',
          'Una etapa bisagra entre la educación inicial y la básica primaria.',
          'Sienta las bases del «aprender a aprender»: anticipar, planear, verbalizar y reflexionar.',
        ],
      },
      {
        title: 'Referentes en la práctica',
        keyIdeas: [
          'Piaget · Kinder y Transition: pensamiento preoperacional; First Grade: inicio de las operaciones concretas.',
          'Vygotsky · el docente modela, guía y ofrece andamiajes.',
          'Diamond · rutinas «planifico – hago – reviso» para la autorregulación.',
          'Goleman · reconocimiento y regulación de emociones.',
        ],
      },
      {
        title: 'Lectoescritura por grado',
        keyIdeas: [
          'Kinder · escritura emergente y conciencia fonológica inicial.',
          'Transition · decodificación: silábica con valor sonoro hacia alfabética emergente.',
          'First Grade · escritura alfabética consolidada y ciclo del escritor: planeo – escribo – reviso – publico.',
        ],
      },
      {
        title: 'CurioCity en KTF',
        keyIdeas: [
          'Investigo · un imán mueve una ficha sin tocarla: ¿cómo lo hizo?',
          'Interactúo · probamos el imán con madera, plástico, metal.',
          'Creo · un «pesca peces» con imanes y clips.',
          'Presento · otro grupo prueba el experimento y escucha la explicación.',
        ],
      },
      {
        title: 'Inglés CLIL y evaluación formativa',
        keyIdeas: [
          'Kinder · comprensión oral y vocabulario temático.',
          'Transition · frases simples y descripciones básicas.',
          'First Grade · producción oral y escrita guiada.',
          'Evaluar para retroalimentar, no para calificar el resultado.',
        ],
      },
    ],
    questions: [
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: 'Según Piaget, ¿qué inicia en First Grade?',
        feedback:
          'Los niños ya clasifican, ordenan y establecen relaciones de causa-efecto simples.',
        options: [
          {
            text: 'El pensamiento operatorio concreto',
            isCorrect: true,
          },
          {
            text: 'El pensamiento formal abstracto',
            isCorrect: false,
          },
          {
            text: 'La etapa sensoriomotora',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.Ordering,
        prompt: 'Ordena el ciclo del escritor que se trabaja en First Grade.',
        feedback: 'Planeo → Escribo → Reviso → Publico.',
        options: [
          {
            text: 'Planeo',
          },
          {
            text: 'Escribo',
          },
          {
            text: 'Reviso',
          },
          {
            text: 'Publico',
          },
        ],
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: '¿Qué rutina ayuda a desarrollar la autorregulación en KTF?',
        feedback: 'Es una aplicación práctica de las funciones ejecutivas (Diamond).',
        options: [
          {
            text: 'Planifico – hago – reviso',
            isCorrect: true,
          },
          {
            text: 'Copiar del tablero en silencio',
            isCorrect: false,
          },
          {
            text: 'Repetir la instrucción tres veces',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.TrueFalse,
        prompt: 'En KTF el inglés se enseña como asignatura aislada, con énfasis en la gramática.',
        feedback: 'Falso: con CLIL el inglés es medio para aprender contenidos.',
        trueFalseAnswer: false,
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: '¿Qué etapas de escritura se esperan en Kinder?',
        feedback: 'Así lo plantea la guía con base en Ferreiro y Teberosky.',
        options: [
          {
            text: 'Presilábica y silábica sin valor sonoro',
            isCorrect: true,
          },
          {
            text: 'Alfabética consolidada',
            isCorrect: false,
          },
          {
            text: 'Silábico-alfabética y ortográfica',
            isCorrect: false,
          },
        ],
      },
    ],
  },
  {
    number: '7',
    section: 'part_4',
    sortOrder: 1,
    title: 'Nuestro talento humano',
    summary:
      'Propósito, principios y competencias institucionales, estructura de liderazgo, y cómo funcionan tu contrato y tu nómina.',
    videoUrl: null,
    videoTitle: 'Video · Nuestro talento humano',
    slides: [],
    questions: [
      {
        type: ChallengeQuestionType.Ordering,
        prompt: 'Ordena la estructura institucional, del nivel más alto al de la academia.',
        feedback:
          'Asamblea de accionistas → Junta Directiva → Rector → Academia. El Revisor Fiscal acompaña a la Junta y el Gerente administrativo y financiero lidera las áreas de apoyo.',
        options: [
          {
            text: 'Asamblea de accionistas',
          },
          {
            text: 'Junta Directiva',
          },
          {
            text: 'Rector',
          },
          {
            text: 'Academia',
          },
        ],
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt:
          '«Actuamos con grandeza de espíritu, generosidad y humildad, reconociendo los méritos ajenos y sirviendo a los demás con alegría». ¿Qué principio es?',
        feedback: 'Así describe GNS el principio de la Nobleza.',
        options: [
          {
            text: 'Nobleza',
            isCorrect: true,
          },
          {
            text: 'Solidaridad',
            isCorrect: false,
          },
          {
            text: 'Disciplina',
            isCorrect: false,
          },
          {
            text: 'Honestidad',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: '¿Cuál de estas NO es una de las 5 competencias institucionales?',
        feedback:
          'Las 5 competencias son orientación a resultados, actitud de servicio, liderazgo, disciplina estratégica y trabajo en equipo.',
        options: [
          {
            text: 'Competitividad individual',
            isCorrect: true,
          },
          {
            text: 'Orientación a resultados',
            isCorrect: false,
          },
          {
            text: 'Actitud de servicio',
            isCorrect: false,
          },
          {
            text: 'Trabajo en equipo',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: 'La competencia «Disciplina estratégica» significa…',
        feedback:
          'Incluye transmitir la estrategia y cuidar los recursos como compromiso con el crecimiento del colegio.',
        options: [
          {
            text: 'Actuar alineados con la visión, ejecutar las funciones con responsabilidad y cuidar los recursos',
            isCorrect: true,
          },
          {
            text: 'Cumplir el horario sin importar los resultados',
            isCorrect: false,
          },
          {
            text: 'Seguir instrucciones sin proponer ideas',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt:
          'En la estructura de liderazgo seccional, ¿quién acompaña directamente a docentes y auxiliares?',
        feedback:
          'Coordinador Académico → coordinadores de área → docente y auxiliar docente, con apoyo de psicología y coordinación de convivencia.',
        options: [
          {
            text: 'Los coordinadores de área, bajo la Coordinación Académica',
            isCorrect: true,
          },
          {
            text: 'La Junta Directiva',
            isCorrect: false,
          },
          {
            text: 'El Revisor Fiscal',
            isCorrect: false,
          },
        ],
      },
      {
        type: ChallengeQuestionType.TrueFalse,
        prompt:
          'El contrato en GNS es directo, a término fijo, con pago mensual del 100% del salario y las variables.',
        feedback: 'Así funciona el contrato y la nómina.',
        trueFalseAnswer: true,
      },
      {
        type: ChallengeQuestionType.MultipleChoice,
        prompt: '¿Con qué banco tiene GNS el convenio de nómina?',
        feedback: 'El convenio de nómina es con el Banco de Bogotá.',
        options: [
          {
            text: 'Banco de Bogotá',
            isCorrect: true,
          },
          {
            text: 'Bancolombia',
            isCorrect: false,
          },
          {
            text: 'Davivienda',
            isCorrect: false,
          },
        ],
      },
    ],
  },
  {
    number: '8',
    section: 'part_4',
    sortOrder: 2,
    title: 'Plan de beneficios GNS 2026–2027',
    summary:
      'Ahorro mutuo, bono de desempeño, bilingüismo, quinquenios, posgrados, cabaña en Coveñas y mucho más. ¡Descúbrelos jugando!',
    videoUrl: null,
    videoTitle: 'Video · Plan de beneficios',
    slides: [],
    questions: [],
  },
];
