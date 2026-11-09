import { RecordStatus } from '../constants/record-status';

/** Operación sobre un registro pedagógico (planeación, diario de campo, anotación del observador). */
export const RecordOperation = {
  Create: 'crear',
  /** Editar contenido y gestionar sus recursos. */
  Edit: 'editar',
  Submit: 'enviar',
  Approve: 'aprobar',
  Return: 'devolver',
  Void: 'anular',
} as const;
export type RecordOperation = (typeof RecordOperation)[keyof typeof RecordOperation];

/** Papel con que se actúa: dueño del registro o coordinación (rol coordinador o superior). */
export const RecordActor = {
  Owner: 'owner',
  Reviewer: 'reviewer',
} as const;
export type RecordActor = (typeof RecordActor)[keyof typeof RecordActor];

export interface RecordTransition {
  /** Estados desde los que se permite la operación. */
  from: readonly RecordStatus[];
  /** Estado resultante; `null` si la operación no lo cambia. */
  to: RecordStatus | null;
}

const { Draft, Submitted, ChangesRequested, Reviewed, Voided } = RecordStatus;

const EDITABLE: readonly RecordStatus[] = [Draft, ChangesRequested];
const ANY_BUT_VOIDED: readonly RecordStatus[] = [Draft, Submitted, ChangesRequested, Reviewed];

/**
 * Máquina de estados común de los registros pedagógicos. Un coordinador que es dueño de
 * su registro tiene ambos papeles (la autorrevisión se impide aparte). `revisada` solo
 * admite anular por coordinación y `anulado` es terminal.
 */
const WORKFLOW: Record<RecordOperation, Partial<Record<RecordActor, RecordTransition>>> = {
  [RecordOperation.Create]: { owner: { from: [], to: Draft } },
  [RecordOperation.Edit]: { owner: { from: EDITABLE, to: null } },
  [RecordOperation.Submit]: { owner: { from: EDITABLE, to: Submitted } },
  [RecordOperation.Approve]: { reviewer: { from: [Submitted], to: Reviewed } },
  [RecordOperation.Return]: { reviewer: { from: [Submitted], to: ChangesRequested } },
  [RecordOperation.Void]: {
    owner: { from: [Draft, Submitted, ChangesRequested], to: Voided },
    reviewer: { from: ANY_BUT_VOIDED, to: Voided },
  },
};

/** Transición permitida a `actor` para `operation`, o `null` si ese papel no puede hacerla. */
export function allowedFrom(
  operation: RecordOperation,
  actor: RecordActor,
): RecordTransition | null {
  return WORKFLOW[operation][actor] ?? null;
}

/** `true` si alguno de los papeles puede hacer `operation` desde `status`. */
export function canTransition(
  operation: RecordOperation,
  actor: RecordActor,
  status: RecordStatus,
): boolean {
  return allowedFrom(operation, actor)?.from.includes(status) ?? false;
}
