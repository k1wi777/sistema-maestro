/** Estado de un módulo dentro de su plan (`modulo_formacion.estado`). */
export const TrainingModuleStatus = {
  Active: 'activo',
  OutOfPlan: 'fuera_del_plan',
} as const;
export type TrainingModuleStatus = (typeof TrainingModuleStatus)[keyof typeof TrainingModuleStatus];

/** Tipo de pregunta del Desafío GNS (`pregunta_desafio.tipo`). */
export const ChallengeQuestionType = {
  MultipleChoice: 'opcion',
  TrueFalse: 'vf',
  Ordering: 'orden',
} as const;
export type ChallengeQuestionType =
  (typeof ChallengeQuestionType)[keyof typeof ChallengeQuestionType];
