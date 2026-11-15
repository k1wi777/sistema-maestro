import {
  TrainingActivityType,
  simulatorConfigSchema,
  type SimulatorConfig,
  type TeacherActivity,
} from '@gns/shared';

export interface ParsedSimulator {
  activity: TeacherActivity;
  config: SimulatorConfig;
}

export type ActivityBlock =
  | { kind: 'activity'; key: string; activity: TeacherActivity }
  /** Simulador cuya configuración no pasa la validación: se muestra como no disponible. */
  | { kind: 'unavailable'; key: string; activity: TeacherActivity }
  /** Simuladores consecutivos, con un selector para elegir uno. */
  | { kind: 'simulators'; key: string; simulators: ParsedSimulator[] };

/**
 * Bloques de la sección de actividades en el orden de la API: uno por actividad, salvo los
 * simuladores consecutivos, que forman uno solo (con un selector). La configuración de un simulador
 * llega sin tipar, así que se valida aquí; la API ya omite las inválidas y esto es una defensa.
 */
export function activityBlocks(activities: TeacherActivity[]): ActivityBlock[] {
  const blocks: ActivityBlock[] = [];
  let open: Extract<ActivityBlock, { kind: 'simulators' }> | null = null;

  for (const activity of activities) {
    if (activity.type !== TrainingActivityType.Simulator) {
      open = null;
      blocks.push({ kind: 'activity', key: activity.id, activity });
      continue;
    }
    const parsed = simulatorConfigSchema.safeParse(activity.config);
    if (!parsed.success) {
      open = null;
      blocks.push({ kind: 'unavailable', key: activity.id, activity });
      continue;
    }
    if (open) {
      open.simulators.push({ activity, config: parsed.data });
    } else {
      open = {
        kind: 'simulators',
        key: activity.id,
        simulators: [{ activity, config: parsed.data }],
      };
      blocks.push(open);
    }
  }
  return blocks;
}
