/** Estado de un módulo dentro de su plan (`modulo_formacion.estado`). */
export const TrainingModuleStatus = {
  Draft: 'borrador',
  Active: 'activo',
  OutOfPlan: 'fuera_del_plan',
} as const;
export type TrainingModuleStatus = (typeof TrainingModuleStatus)[keyof typeof TrainingModuleStatus];

/** Estado de una actividad del módulo (`actividad_modulo.estado`); no admite borrador. */
export const TrainingActivityStatus = {
  Active: 'activo',
  OutOfPlan: 'fuera_del_plan',
} as const;
export type TrainingActivityStatus =
  (typeof TrainingActivityStatus)[keyof typeof TrainingActivityStatus];

/** Tipo de pregunta del Desafío GNS (`pregunta_desafio.tipo`). */
export const ChallengeQuestionType = {
  MultipleChoice: 'opcion',
  TrueFalse: 'vf',
  Ordering: 'orden',
} as const;
export type ChallengeQuestionType =
  (typeof ChallengeQuestionType)[keyof typeof ChallengeQuestionType];

/** Tipo de actividad configurable de un módulo (`actividad_modulo.tipo`). */
export const TrainingActivityType = {
  WheelPassport: 'ruleta_pasaporte',
  Match: 'conecta',
  TrueOrMyth: 'verdad_o_mito',
  Simulator: 'simulador',
} as const;
export type TrainingActivityType = (typeof TrainingActivityType)[keyof typeof TrainingActivityType];

/** Estado de un módulo para un docente en su ruta (calculado, no se guarda). */
export const TeacherModuleState = {
  Pending: 'pendiente',
  InProgress: 'en_curso',
  Done: 'terminado',
} as const;
export type TeacherModuleState = (typeof TeacherModuleState)[keyof typeof TeacherModuleState];

/** Para qué se guarda un objeto del almacenamiento (`archivo.proposito`). */
export const StoredFilePurpose = {
  ModuleVideo: 'video_modulo',
  ModulePresentation: 'presentacion_modulo',
  Certificate: 'certificado',
} as const;
export type StoredFilePurpose = (typeof StoredFilePurpose)[keyof typeof StoredFilePurpose];

/** Estado de un objeto del almacenamiento (`archivo.estado`). */
export const StoredFileStatus = {
  Pending: 'pendiente',
  Available: 'disponible',
  Rejected: 'rechazado',
} as const;
export type StoredFileStatus = (typeof StoredFileStatus)[keyof typeof StoredFileStatus];

/** Tipo de certificado: de un módulo o de la ruta completa (calculado: `modulo_id` nulo = ruta). */
export const CertificateKind = {
  Module: 'modulo',
  Route: 'ruta',
} as const;
export type CertificateKind = (typeof CertificateKind)[keyof typeof CertificateKind];

/** Estado de un módulo para un docente en el seguimiento de coordinación (calculado, no se guarda). */
export const TrackingModuleState = {
  NotStarted: 'sin_iniciar',
  InProgress: 'en_curso',
  Done: 'terminado',
} as const;
export type TrackingModuleState = (typeof TrackingModuleState)[keyof typeof TrackingModuleState];
