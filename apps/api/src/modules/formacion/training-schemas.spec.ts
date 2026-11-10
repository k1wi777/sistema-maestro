import {
  challengeQuestionInputSchema,
  createActivitySchema,
  createTrainingModuleSchema,
  createTrainingPlanSchema,
  createTrainingSectionSchema,
  orderSchema,
  parseActivityConfig,
  simulatorConfigSchema,
  simulatorUseBodySchema,
  teacherActivitySchema,
  teacherModuleSchema,
  TrainingActivityType,
  updateActivitySchema,
  updateTrainingModuleSchema,
  updateTrainingPlanSchema,
} from '@gns/shared';

const UUID = '3f0c2f64-7e1c-4a43-9a58-0e4e5c7d9a10';
const OTHER_UUID = '9a7b2a0e-5a5e-4c19-8d6b-1f2e3d4c5b6a';

describe('plan and section schemas', () => {
  it('defaults a plan to General (no area) and any school year', () => {
    expect(createTrainingPlanSchema.parse({ name: 'Plan de matemáticas' })).toEqual({
      name: 'Plan de matemáticas',
      areaId: null,
      schoolYear: null,
    });
  });

  it('rejects a school year without consecutive years and an unknown field', () => {
    expect(createTrainingPlanSchema.safeParse({ name: 'x', schoolYear: '2026-2028' }).success).toBe(
      false,
    );
    expect(createTrainingPlanSchema.safeParse({ name: 'x', extra: 1 }).success).toBe(false);
  });

  it('does not let a plan change its area', () => {
    expect(updateTrainingPlanSchema.safeParse({ areaId: UUID }).success).toBe(false);
    expect(updateTrainingPlanSchema.safeParse({ name: 'Nuevo' }).success).toBe(true);
  });

  it('accepts a section with title and optional subtitle and rejects an empty title', () => {
    expect(createTrainingSectionSchema.parse({ title: 'Parte I' }).subtitle).toBeNull();
    expect(createTrainingSectionSchema.safeParse({ title: '  ' }).success).toBe(false);
    expect(createTrainingSectionSchema.safeParse({ title: 'x'.repeat(121) }).success).toBe(false);
  });
});

describe('module schemas', () => {
  it('fills the defaults of a new module', () => {
    expect(createTrainingModuleSchema.parse({ title: 'Módulo' })).toMatchObject({
      number: null,
      approvalThreshold: 80,
      secondsPerQuestion: null,
      videoUrl: null,
    });
  });

  it.each([
    ['an http video link', { title: 'm', videoUrl: 'http://gns.test/v' }],
    ['a threshold above 100', { title: 'm', approvalThreshold: 101 }],
    ['seconds below 5', { title: 'm', secondsPerQuestion: 4 }],
    ['a number longer than 4', { title: 'm', number: '12345' }],
  ])('rejects %s', (_name, body) => {
    expect(createTrainingModuleSchema.safeParse(body).success).toBe(false);
  });

  it('lets an edit carry a target section', () => {
    expect(updateTrainingModuleSchema.safeParse({ sectionId: UUID }).success).toBe(true);
    expect(updateTrainingModuleSchema.safeParse({ planId: UUID }).success).toBe(false);
  });
});

describe('order schema', () => {
  it('accepts a list of unique ids', () => {
    expect(orderSchema.safeParse({ ids: [UUID, OTHER_UUID] }).success).toBe(true);
  });

  it.each([
    ['repeated ids', { ids: [UUID, UUID] }],
    ['an empty list', { ids: [] }],
    ['a non UUID', { ids: ['uno'] }],
  ])('rejects %s', (_name, body) => {
    expect(orderSchema.safeParse(body).success).toBe(false);
  });
});

describe('challenge question schema', () => {
  const base = { prompt: '¿Cuál es?', feedback: null };

  it('accepts a multiple choice question with exactly one correct option', () => {
    const parsed = challengeQuestionInputSchema.safeParse({
      ...base,
      type: 'opcion',
      options: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it.each([
    [
      'no correct option',
      [
        { text: 'A', isCorrect: false },
        { text: 'B', isCorrect: false },
      ],
    ],
    [
      'two correct options',
      [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: true },
      ],
    ],
    ['a single option', [{ text: 'A', isCorrect: true }]],
    [
      'five options',
      ['A', 'B', 'C', 'D', 'E'].map((text, index) => ({ text, isCorrect: index === 0 })),
    ],
  ])('rejects a multiple choice question with %s', (_name, options) => {
    expect(
      challengeQuestionInputSchema.safeParse({ ...base, type: 'opcion', options }).success,
    ).toBe(false);
  });

  it('accepts true or false only with its answer and without options', () => {
    expect(
      challengeQuestionInputSchema.safeParse({ ...base, type: 'vf', trueFalseAnswer: false })
        .success,
    ).toBe(true);
    expect(
      challengeQuestionInputSchema.safeParse({
        ...base,
        type: 'vf',
        trueFalseAnswer: true,
        options: [],
      }).success,
    ).toBe(false);
    expect(challengeQuestionInputSchema.safeParse({ ...base, type: 'vf' }).success).toBe(false);
  });

  it('accepts 2 to 5 ordered steps', () => {
    const steps = (count: number) => Array.from({ length: count }, (_x, index) => `Paso ${index}`);

    expect(
      challengeQuestionInputSchema.safeParse({ ...base, type: 'orden', steps: steps(2) }).success,
    ).toBe(true);
    expect(
      challengeQuestionInputSchema.safeParse({ ...base, type: 'orden', steps: steps(5) }).success,
    ).toBe(true);
    expect(
      challengeQuestionInputSchema.safeParse({ ...base, type: 'orden', steps: steps(1) }).success,
    ).toBe(false);
    expect(
      challengeQuestionInputSchema.safeParse({ ...base, type: 'orden', steps: steps(6) }).success,
    ).toBe(false);
  });
});

describe('activity schemas', () => {
  const match = {
    pares: [
      { concepto: 'A', dato: 'a' },
      { concepto: 'B', dato: 'b' },
    ],
    pares_por_ronda: 2,
    rondas: 1,
    segundos_por_ronda: 30,
    umbral_aprobacion: 80,
  };

  it('validates the configuration with the schema of its type', () => {
    const valid = createActivitySchema.safeParse({
      type: TrainingActivityType.Match,
      title: 'Conecta',
      isRequired: true,
      config: match,
    });
    const invalid = createActivitySchema.safeParse({
      type: TrainingActivityType.TrueOrMyth,
      title: 'Mitos',
      isRequired: true,
      config: match,
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it('rejects an edit that tries to change the type', () => {
    expect(updateActivitySchema.safeParse({ type: TrainingActivityType.Simulator }).success).toBe(
      false,
    );
    expect(updateActivitySchema.safeParse({ title: 'Nuevo título' }).success).toBe(true);
  });

  it('requires an empty strict body to use a simulator', () => {
    expect(simulatorUseBodySchema.safeParse({}).success).toBe(true);
    expect(simulatorUseBodySchema.safeParse({ salario: 1000 }).success).toBe(false);
  });
});

describe('simulator result keys', () => {
  const config = {
    entradas: [
      {
        clave: 'x',
        etiqueta: 'X',
        tipo: 'numero',
        min: 0,
        max: 10,
        paso: 1,
        inicial: 1,
      },
    ],
    constantes: [],
    calculos: [{ clave: 'total', expresion: { ref: 'x' } }],
    resultados: [{ clave: 'total', etiqueta: 'Total', formato: 'numero' }],
    notas: [],
  };

  it('rejects two results with the same key', () => {
    const repeated = {
      ...config,
      resultados: [...config.resultados, { clave: 'total', etiqueta: 'Otra', formato: 'numero' }],
    };

    expect(simulatorConfigSchema.safeParse(config).success).toBe(true);
    expect(simulatorConfigSchema.safeParse(repeated).success).toBe(false);
    expect(parseActivityConfig(TrainingActivityType.Simulator, repeated).success).toBe(false);
  });
});

describe('teacher schemas', () => {
  it('are strict: an extra solution field is rejected', () => {
    const moduleBase = {
      id: UUID,
      planId: UUID,
      section: { id: UUID, title: 'Parte' },
      number: '1',
      title: 'M',
      summary: null,
      videoUrl: null,
      videoTitle: null,
      presentationUrl: null,
      slides: [],
      challenge: { questionCount: 0, approvalThreshold: 80, secondsPerQuestion: null },
      state: 'pendiente',
      progress: {
        videoViewedAt: null,
        presentationViewedAt: null,
        bestScore: null,
        bestPoints: null,
        attempts: 0,
        passedAt: null,
        completedAt: null,
      },
      activities: [],
    };

    expect(teacherModuleSchema.safeParse(moduleBase).success).toBe(true);
    expect(teacherModuleSchema.safeParse({ ...moduleBase, questions: [] }).success).toBe(false);
  });

  it('rejects a wheel card that carries its correct answer', () => {
    const activity = {
      id: UUID,
      type: 'ruleta_pasaporte',
      title: 'Ruleta',
      isRequired: false,
      instructions: null,
      progress: { completedAt: null, bestScore: null, bestPoints: null, attempts: 0, stamps: [] },
      config: {
        insignia: 'Insignia',
        tarjetas: [
          {
            clave: 'a',
            emoji: '🙂',
            titulo_corto: 'A',
            titulo: 'A',
            dato: 'd',
            hechos: ['h'],
            pregunta: { enunciado: '¿?', opciones: ['x', 'y'], correcta: 1 },
          },
        ],
      },
    };

    expect(teacherActivitySchema.safeParse(activity).success).toBe(false);
  });
});
