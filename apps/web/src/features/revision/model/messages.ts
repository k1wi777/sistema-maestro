import { RecordStatus } from '@gns/shared';

/**
 * Convierte el motivo de un esquema de `@gns/shared` («es obligatorio», «debe tener como máximo 80
 * caracteres») en una frase para pintar junto al campo. Los motivos nunca contienen el valor
 * rechazado, así que no hay nada que quitar aquí.
 */
export function sentence(reason: string): string {
  const text = reason.trim();
  if (text === '') {
    return 'El valor no es válido.';
  }
  const capitalized = text.charAt(0).toLocaleUpperCase('es') + text.slice(1);
  return /[.!?»]$/u.test(capitalized) ? capitalized : `${capitalized}.`;
}

/** Por qué coordinación no puede ajustar, observar ni decidir sobre un registro. */
export function readOnlyReason(status: RecordStatus, own: boolean): string | null {
  if (own) {
    return 'Esta planeación es tuya: no puedes revisarla. Otra persona de coordinación debe hacerlo.';
  }
  switch (status) {
    case RecordStatus.Submitted:
      return null;
    case RecordStatus.Draft:
      return 'La planeación sigue en borrador: el docente aún no la envía a revisión.';
    case RecordStatus.ChangesRequested:
      return 'Ya se devolvió con observaciones: queda a la espera de que el docente la corrija y la reenvíe.';
    case RecordStatus.Reviewed:
      return 'La planeación ya está revisada y solo se puede consultar o anular.';
    case RecordStatus.Voided:
      return 'La planeación está anulada: queda en solo lectura.';
    default:
      return null;
  }
}

/** Igual que `readOnlyReason` para diarios de campo y anotaciones del observador. */
export function formatReadOnlyReason(
  status: RecordStatus,
  own: boolean,
  noun: 'hoja' | 'anotación',
): string | null {
  const article = noun === 'hoja' ? 'La hoja' : 'La anotación';
  if (own) {
    return `Esta ${noun} es tuya: no puedes revisarla. Otra persona de coordinación debe hacerlo.`;
  }
  switch (status) {
    case RecordStatus.Submitted:
      return null;
    case RecordStatus.Draft:
      return `${article} sigue en borrador: el docente aún no la envía a revisión.`;
    case RecordStatus.ChangesRequested:
      return `${article} ya se devolvió con observaciones: queda a la espera de que el docente la corrija y la reenvíe.`;
    case RecordStatus.Reviewed:
      return `${article} ya está revisada y solo se puede consultar o anular.`;
    case RecordStatus.Voided:
      return `${article} está anulada: queda en solo lectura.`;
    default:
      return null;
  }
}

export const CONFLICT_MESSAGE =
  'El registro cambió de estado en el servidor (puede que otra persona ya lo revisó o que el docente lo retiró). Lo recargamos con su estado actual.';

export const SELF_REVIEW_MESSAGE =
  'No puedes revisar un registro tuyo: otra persona de coordinación debe hacerlo.';

export const DRAFT_SAVED_MESSAGE =
  'Guardado en este navegador; el docente no lo verá hasta que decidas.';

export const DRAFT_DISCARDED_MESSAGES = {
  changed: 'La planeación cambió desde que guardaste tus ajustes, así que se descartaron.',
  status:
    'La planeación ya no está pendiente de revisión, así que se descartaron tus ajustes guardados.',
  corrupt: 'Lo guardado en este navegador no se pudo leer y se descartó.',
} as const;

export const DRAFT_RESTORED_MESSAGE =
  'Recuperamos tus ajustes y observaciones guardados en este navegador. El docente aún no los ve.';
