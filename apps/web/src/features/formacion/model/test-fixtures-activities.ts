import { TrainingActivityType, type TeacherActivity } from '@gns/shared';

import { uuid } from './test-fixtures';

/** Actividad de un módulo (tipo Conecta) para las pruebas; solo la usan las pruebas de este módulo. */
export function makeTeacherActivity(overrides: Partial<TeacherActivity> = {}): TeacherActivity {
  return {
    id: uuid(900),
    title: 'Conecta los conceptos',
    isRequired: true,
    instructions: null,
    progress: { completedAt: null, bestScore: null, bestPoints: null, attempts: 0, stamps: [] },
    type: TrainingActivityType.Match,
    config: { pares_por_ronda: 4, rondas: 2, segundos_por_ronda: 60, umbral_aprobacion: 80 },
    ...overrides,
  } as TeacherActivity;
}
