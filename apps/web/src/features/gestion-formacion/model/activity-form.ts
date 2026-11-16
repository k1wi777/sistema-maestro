import {
  createActivitySchema,
  parseActivityConfig,
  TrainingActivityType,
  updateActivitySchema,
  type Activity,
  type CreateActivityInput,
  type UpdateActivityInput,
} from '@gns/shared';

import { initialMatchForm, matchFromForm, matchToForm, type MatchForm } from './match-form';
import {
  initialSimulatorForm,
  simulatorFromForm,
  simulatorToForm,
  type SimulatorForm,
} from './simulator-form';
import {
  initialTrueOrMythForm,
  trueOrMythFromForm,
  trueOrMythToForm,
  type TrueOrMythForm,
} from './true-or-myth-form';
import { initialWheelForm, wheelFromForm, wheelToForm, type WheelForm } from './wheel-form';

export type ActivityType = TrainingActivityType;

export interface ConfigFormByType {
  ruleta_pasaporte: WheelForm;
  conecta: MatchForm;
  verdad_o_mito: TrueOrMythForm;
  simulador: SimulatorForm;
}

interface DraftBase {
  /** `null` es una actividad nueva. */
  id: string | null;
  title: string;
  instructions: string;
  isRequired: boolean;
}

/** Borrador de una actividad: lo común más el formulario de la configuración de su tipo. */
export type ActivityDraft = {
  [Type in ActivityType]: DraftBase & { type: Type; config: ConfigFormByType[Type] };
}[ActivityType];

export const ACTIVITY_TYPES: readonly ActivityType[] = [
  TrainingActivityType.WheelPassport,
  TrainingActivityType.Match,
  TrainingActivityType.TrueOrMyth,
  TrainingActivityType.Simulator,
];

/** Actividad nueva del tipo dado, con los valores iniciales de cada tipo. */
export function newDraft(type: ActivityType): ActivityDraft {
  const base = { id: null, title: '', instructions: '', isRequired: false };
  switch (type) {
    case TrainingActivityType.WheelPassport:
      return { ...base, type, config: initialWheelForm() };
    case TrainingActivityType.Match:
      return { ...base, type, config: initialMatchForm() };
    case TrainingActivityType.TrueOrMyth:
      return { ...base, type, config: initialTrueOrMythForm() };
    case TrainingActivityType.Simulator:
      return { ...base, type, config: initialSimulatorForm() };
  }
}

export type DraftResult = { editable: true; draft: ActivityDraft } | { editable: false };

/** La actividad guardada como borrador; si su configuración no pasa el esquema, no se puede editar. */
export function toDraft(activity: Activity): DraftResult {
  const base = {
    id: activity.id,
    title: activity.title,
    instructions: activity.instructions ?? '',
    isRequired: activity.isRequired,
  };
  switch (activity.type) {
    case TrainingActivityType.WheelPassport: {
      const parsed = parseActivityConfig(activity.type, activity.config);
      return parsed.success
        ? {
            editable: true,
            draft: { ...base, type: activity.type, config: wheelToForm(parsed.data) },
          }
        : { editable: false };
    }
    case TrainingActivityType.Match: {
      const parsed = parseActivityConfig(activity.type, activity.config);
      return parsed.success
        ? {
            editable: true,
            draft: { ...base, type: activity.type, config: matchToForm(parsed.data) },
          }
        : { editable: false };
    }
    case TrainingActivityType.TrueOrMyth: {
      const parsed = parseActivityConfig(activity.type, activity.config);
      return parsed.success
        ? {
            editable: true,
            draft: { ...base, type: activity.type, config: trueOrMythToForm(parsed.data) },
          }
        : { editable: false };
    }
    case TrainingActivityType.Simulator: {
      const parsed = parseActivityConfig(activity.type, activity.config);
      return parsed.success
        ? {
            editable: true,
            draft: { ...base, type: activity.type, config: simulatorToForm(parsed.data) },
          }
        : { editable: false };
    }
  }
}

/** Configuración candidata (sin validar) del borrador, según su tipo. */
export function configCandidate(draft: ActivityDraft): unknown {
  switch (draft.type) {
    case TrainingActivityType.WheelPassport:
      return wheelFromForm(draft.config);
    case TrainingActivityType.Match:
      return matchFromForm(draft.config);
    case TrainingActivityType.TrueOrMyth:
      return trueOrMythFromForm(draft.config);
    case TrainingActivityType.Simulator:
      return simulatorFromForm(draft.config);
  }
}

// ---------- Mensajes de error en español ----------

/** Parte de un aviso de Zod que usamos para traducirlo (sin importar `zod`). */
interface Issue {
  code: string;
  path: readonly PropertyKey[];
  message: string;
  origin?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  format?: string;
  expected?: string;
}

const LIMIT = 1e12;

/** Rango permitido de los números de la configuración, por el último nombre de su ruta. */
const NUMBER_RANGE: Record<string, readonly [number, number]> = {
  pares_por_ronda: [2, 10],
  rondas: [1, 10],
  segundos_por_ronda: [5, 600],
  umbral_aprobacion: [0, 100],
  por_partida: [1, 60],
  vidas: [1, 10],
  segundos_por_afirmacion: [3, 120],
  decimales: [0, 4],
  min: [-LIMIT, LIMIT],
  max: [-LIMIT, LIMIT],
  inicial: [-LIMIT, LIMIT],
  valor: [-LIMIT, LIMIT],
  hasta: [-LIMIT, LIMIT],
  correcta: [0, 3],
};

/** Mensajes de reglas cruzadas del esquema que nombran campos técnicos. */
const CUSTOM_MESSAGE: Record<string, string> = {
  'Se necesitan al menos pares_por_ronda × rondas pares.':
    'Faltan pares: necesitas al menos pares por ronda × rondas.',
  'Una partida no puede tener más afirmaciones que las configuradas.':
    'Una partida no puede tener más afirmaciones que las escritas.',
};

function formatLimit(value: number): string {
  return Math.abs(value) >= LIMIT ? '1.000.000.000.000' : String(value);
}

/** Traduce al español un aviso del esquema compartido; los `custom` ya vienen en español. */
export function issueMessage(issue: Issue): string {
  const leaf = String(issue.path[issue.path.length - 1] ?? '');
  const minimum = typeof issue.minimum === 'bigint' ? Number(issue.minimum) : issue.minimum;
  const maximum = typeof issue.maximum === 'bigint' ? Number(issue.maximum) : issue.maximum;
  if (leaf === 'correcta') {
    return 'Marca la respuesta correcta.';
  }
  switch (issue.code) {
    case 'too_small':
      if (issue.origin === 'string') {
        return 'Escríbelo.';
      }
      if (issue.origin === 'array') {
        return `Agrega al menos ${minimum ?? 1}.`;
      }
      return rangeMessage(leaf, minimum, undefined);
    case 'too_big':
      if (issue.origin === 'string') {
        return `Escribe como máximo ${maximum ?? ''} caracteres.`;
      }
      if (issue.origin === 'array') {
        return `Como máximo ${maximum ?? ''}.`;
      }
      return rangeMessage(leaf, undefined, maximum);
    case 'invalid_type':
      return issue.expected === 'number' ? 'Escribe un número.' : 'Completa este dato.';
    case 'invalid_format':
      if (issue.format === 'url') {
        return 'Usa una dirección https.';
      }
      return leaf === 'ref' ? 'Elige un valor.' : issue.message;
    case 'invalid_value':
      return 'Elige una opción.';
    case 'custom':
      return CUSTOM_MESSAGE[issue.message] ?? issue.message;
    default:
      return 'Revisa este dato.';
  }
}

function rangeMessage(
  leaf: string,
  minimum: number | undefined,
  maximum: number | undefined,
): string {
  const range = NUMBER_RANGE[leaf];
  if (range) {
    return `Usa un número entre ${formatLimit(range[0])} y ${formatLimit(range[1])}.`;
  }
  if (minimum !== undefined) {
    return `Usa un número mayor${minimum > 0 ? ' que cero' : ` o igual a ${minimum}`}.`;
  }
  return `Usa un número menor o igual a ${maximum ?? 0}.`;
}

/** Errores por ruta del esquema unida con puntos: `config.tarjetas.2.titulo_corto`. */
export type DraftErrors = Record<string, string>;

function collect(issues: readonly Issue[], prefix: readonly PropertyKey[], into: DraftErrors) {
  for (const issue of issues) {
    const key = [...prefix, ...issue.path].map(String).join('.');
    if (!(key in into)) {
      into[key] = issueMessage(issue);
    }
  }
}

export type DraftValidation =
  | { ok: true; create: CreateActivityInput; update: UpdateActivityInput }
  | { ok: false; errors: DraftErrors };

/**
 * Valida con los esquemas compartidos (una sola fuente de reglas): `create` es el cuerpo de una
 * actividad nueva y `update` el de una existente, ambos con la configuración ya interpretada.
 */
export function validateDraft(draft: ActivityDraft): DraftValidation {
  const errors: DraftErrors = {};
  const config = parseActivityConfig(draft.type, configCandidate(draft));
  if (!config.success) {
    collect(config.error.issues, ['config'], errors);
  }
  const instructions = draft.instructions.trim() === '' ? null : draft.instructions.trim();
  const head = createActivitySchema.safeParse({
    type: draft.type,
    title: draft.title.trim(),
    isRequired: draft.isRequired,
    instructions,
    config: config.success ? config.data : null,
  });
  if (!head.success) {
    collect(
      head.error.issues.filter((issue) => issue.path[0] !== 'config'),
      [],
      errors,
    );
  }
  if (!config.success || !head.success) {
    return { ok: false, errors };
  }
  const update = updateActivitySchema.parse({
    title: draft.title.trim(),
    instructions,
    config: config.data,
  });
  return { ok: true, create: head.data, update };
}

/** Mensajes de errores cuya ruta empieza por `prefix` (el propio nodo o cualquiera de sus hijos). */
export function errorsUnder(errors: DraftErrors, prefix: string): string[] {
  return Object.entries(errors)
    .filter(([key]) => key === prefix || key.startsWith(`${prefix}.`))
    .map(([, message]) => message);
}

// ---------- Cambios sin guardar ----------

/** Huella normalizada del borrador: espacios sobrantes fuera, para saber si cambió. */
function fingerprint(draft: ActivityDraft): string {
  return JSON.stringify(draft, (_key, value: unknown) =>
    typeof value === 'string' ? value.trim() : value,
  );
}

/**
 * ¿Hay cambios por guardar? Una actividad existente se compara con lo guardado; una nueva, con sus
 * valores iniciales (abrir el formulario y no escribir nada no obliga a guardar).
 */
export function isDraftDirty(saved: ActivityDraft | null, draft: ActivityDraft): boolean {
  const baseline = saved ?? newDraft(draft.type);
  return fingerprint(baseline) !== fingerprint({ ...draft, id: baseline.id });
}
