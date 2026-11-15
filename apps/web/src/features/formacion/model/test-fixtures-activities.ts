import {
  TrainingActivityType,
  type ActivityGameAnswerResult,
  type MatchRound,
  type SimulatorConfig,
  type TeacherActivity,
  type TrueOrMythAnswerResult,
} from '@gns/shared';

import { uuid } from './test-fixtures';

type ActivityOf<T extends TrainingActivityType> = Extract<TeacherActivity, { type: T }>;

const emptyProgress = {
  completedAt: null,
  bestScore: null,
  bestPoints: null,
  attempts: 0,
  stamps: [],
};

/** Actividad de un módulo (tipo Conecta) para las pruebas; solo la usan las pruebas de este módulo. */
export function makeTeacherActivity(overrides: Partial<TeacherActivity> = {}): TeacherActivity {
  return {
    id: uuid(900),
    title: 'Conecta los conceptos',
    isRequired: true,
    instructions: null,
    progress: emptyProgress,
    type: TrainingActivityType.Match,
    config: { pares_por_ronda: 4, rondas: 2, segundos_por_ronda: 60, umbral_aprobacion: 80 },
    ...overrides,
  } as TeacherActivity;
}

export function makeWheelActivity(
  overrides: Partial<ActivityOf<'ruleta_pasaporte'>> = {},
): ActivityOf<'ruleta_pasaporte'> {
  const card = (key: string, emoji: string) => ({
    clave: key,
    emoji,
    titulo_corto: `Corto ${key}`,
    titulo: `Título ${key}`,
    dato: `Dato ${key}`,
    hechos: [`Hecho de ${key}`],
    pregunta: { enunciado: `¿Pregunta ${key}?`, opciones: ['Uno', 'Dos', 'Tres'] },
  });
  return {
    id: uuid(901),
    title: 'Beneficios',
    isRequired: true,
    instructions: null,
    progress: emptyProgress,
    type: TrainingActivityType.WheelPassport,
    config: {
      insignia: 'Insignia GNS',
      tarjetas: [card('a', '🐷'), card('b', '🏅'), card('c', '🎂')],
    },
    ...overrides,
  };
}

export function makeTrueOrMythActivity(
  overrides: Partial<ActivityOf<'verdad_o_mito'>> = {},
): ActivityOf<'verdad_o_mito'> {
  return {
    id: uuid(902),
    title: '¿Verdad o mito?',
    isRequired: true,
    instructions: null,
    progress: emptyProgress,
    type: TrainingActivityType.TrueOrMyth,
    config: { por_partida: 10, vidas: 3, segundos_por_afirmacion: 10, umbral_aprobacion: 70 },
    ...overrides,
  };
}

export const SIMULATOR_CONFIG: SimulatorConfig = {
  entradas: [
    {
      clave: 'salario',
      etiqueta: 'Salario mensual',
      solo_en_pantalla: true,
      tipo: 'moneda',
      min: 0,
      paso: 1000,
    },
    {
      clave: 'anios',
      etiqueta: 'Años',
      solo_en_pantalla: false,
      tipo: 'numero',
      min: 1,
      max: 30,
      paso: 1,
      inicial: 5,
    },
  ],
  constantes: [{ clave: 'factor', valor: 12 }],
  calculos: [
    {
      clave: 'anual',
      expresion: { op: 'multiplica', args: [{ ref: 'salario' }, { ref: 'factor' }] },
    },
    { clave: 'cuota', expresion: { op: 'divide', args: [{ ref: 'anual' }, { ref: 'anios' }] } },
    {
      clave: 'alto',
      expresion: { op: 'compara', comparacion: 'mayor', args: [{ ref: 'anual' }, 1000000] },
    },
  ],
  resultados: [
    { clave: 'anual', etiqueta: 'Total al año', formato: 'moneda' },
    { clave: 'cuota', etiqueta: 'Cuota', formato: 'numero' },
    { clave: 'alto', etiqueta: 'Es alto', formato: 'si_no' },
  ],
  notas: [{ texto: 'Es una cifra alta.', cuando: 'alto' }, { texto: 'Siempre visible.' }],
  icono: '🐷',
  destacado: { clave: 'anual', subtitulo: 'al año' },
};

export function makeSimulatorActivity(
  overrides: Partial<ActivityOf<'simulador'>> = {},
): ActivityOf<'simulador'> {
  return {
    id: uuid(903),
    title: 'Simulador',
    isRequired: false,
    instructions: null,
    progress: emptyProgress,
    type: TrainingActivityType.Simulator,
    config: SIMULATOR_CONFIG,
    ...overrides,
  };
}

export function makeMatchRound(overrides: Partial<MatchRound> = {}): MatchRound {
  return {
    round: 1,
    totalRounds: 2,
    seconds: 45,
    concepts: [
      { token: 'c1', concepto: 'Uno', emoji: '🐷' },
      { token: 'c2', concepto: 'Dos' },
    ],
    facts: [
      { token: 'f1', dato: 'Dato uno' },
      { token: 'f2', dato: 'Dato dos' },
    ],
    ...overrides,
  };
}

export const GAME_RESULT = {
  score: 100,
  points: 800,
  passed: true,
  bestScore: 100,
  bestPoints: 800,
  completedAt: null,
};

export function makeMatchAnswer(
  overrides: Partial<Extract<ActivityGameAnswerResult, { type: 'conecta' }>> = {},
): Extract<ActivityGameAnswerResult, { type: 'conecta' }> {
  return {
    type: 'conecta',
    correct: true,
    firstAttempt: true,
    pointsGained: 100,
    streak: 1,
    totalPoints: 100,
    connected: 1,
    roundOver: false,
    finished: false,
    ...overrides,
  };
}

export function makeMythAnswer(
  overrides: Partial<TrueOrMythAnswerResult> = {},
): TrueOrMythAnswerResult {
  return {
    type: 'verdad_o_mito',
    correct: true,
    timedOut: false,
    isTrue: true,
    explanation: 'Porque sí.',
    lives: 3,
    pointsGained: 100,
    streak: 1,
    totalPoints: 100,
    position: 1,
    finished: false,
    ...overrides,
  };
}
