import { z } from 'zod';
import { TrainingActivityType } from '../constants/training';
import { matchConfigSchema, type MatchConfig } from './match';
import { simulatorConfigSchema, type SimulatorConfig } from './simulator';
import { trueOrMythConfigSchema, type TrueOrMythConfig } from './true-or-myth';
import {
  wheelPassportConfigSchema,
  wheelPassportDetailSchema,
  type WheelPassportConfig,
  type WheelPassportDetail,
} from './wheel-passport';

export * from './common';
export * from './match';
export * from './module-settings';
export * from './simulator';
export * from './simulator-evaluator';
export * from './true-or-myth';
export * from './wheel-passport';

/** Configuración tipada de cada tipo de actividad (`actividad_modulo.configuracion`). */
export interface ActivityConfigByType {
  ruleta_pasaporte: WheelPassportConfig;
  conecta: MatchConfig;
  verdad_o_mito: TrueOrMythConfig;
  simulador: SimulatorConfig;
}

/** Detalle tipado de cada tipo (`progreso_actividad.detalle`); nulo salvo en el pasaporte. */
export interface ActivityProgressDetailByType {
  ruleta_pasaporte: WheelPassportDetail;
  conecta: null;
  verdad_o_mito: null;
  simulador: null;
}

const nullDetailSchema = z.null({ error: 'El detalle de esta actividad debe ser nulo.' });

const configSchemas = {
  [TrainingActivityType.WheelPassport]: wheelPassportConfigSchema,
  [TrainingActivityType.Match]: matchConfigSchema,
  [TrainingActivityType.TrueOrMyth]: trueOrMythConfigSchema,
  [TrainingActivityType.Simulator]: simulatorConfigSchema,
} as const;

/** Valida la configuración de una actividad según su tipo; devuelve el valor tipado o el error de Zod. */
export function parseActivityConfig<T extends TrainingActivityType>(
  type: T,
  json: unknown,
): z.ZodSafeParseResult<ActivityConfigByType[T]> {
  return configSchemas[type].safeParse(json) as z.ZodSafeParseResult<ActivityConfigByType[T]>;
}

/**
 * Valida el detalle de progreso de una actividad. Solo el pasaporte guarda
 * detalle (sus sellos, que deben ser tarjetas de la configuración); en los
 * demás tipos debe ser nulo. Los valores de un simulador nunca se persisten.
 */
export function parseActivityProgressDetail<T extends TrainingActivityType>(
  type: T,
  json: unknown,
  config: unknown,
): z.ZodSafeParseResult<ActivityProgressDetailByType[T]> {
  if (type !== TrainingActivityType.WheelPassport) {
    return nullDetailSchema.safeParse(json) as z.ZodSafeParseResult<
      ActivityProgressDetailByType[T]
    >;
  }
  const parsedConfig = wheelPassportConfigSchema.safeParse(config);
  const keys = new Set(
    parsedConfig.success ? parsedConfig.data.tarjetas.map((card) => card.clave) : [],
  );
  return wheelPassportDetailSchema
    .refine((detail) => new Set(detail.sellos).size === detail.sellos.length, {
      path: ['sellos'],
      message: 'Los sellos no pueden repetirse.',
    })
    .refine((detail) => detail.sellos.every((stamp) => keys.has(stamp)), {
      path: ['sellos'],
      message: 'Cada sello debe corresponder a una tarjeta del pasaporte.',
    })
    .safeParse(json) as z.ZodSafeParseResult<ActivityProgressDetailByType[T]>;
}
