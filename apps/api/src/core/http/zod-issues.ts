import type { ApiFieldError } from '@gns/shared';
import type { z } from 'zod';

const TYPE_NAMES: Record<string, string> = {
  string: 'texto',
  number: 'número',
  int: 'entero',
  boolean: 'verdadero o falso',
  object: 'objeto',
  array: 'lista',
};

/** Texto en español del motivo de un problema de validación de Zod. */
export function describeIssue(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      // Zod no conserva el valor recibido (no se filtra); su mensaje por defecto sí dice si faltaba.
      return issue.message.endsWith('received undefined')
        ? 'es obligatorio'
        : `debe ser de tipo ${TYPE_NAMES[issue.expected] ?? issue.expected}`;
    case 'invalid_value':
      return `valor no permitido (admitidos: ${issue.values.map(String).join(', ')})`;
    case 'too_big':
      return issue.origin === 'string' || issue.origin === 'array'
        ? `debe tener como máximo ${String(issue.maximum)} ${issue.origin === 'string' ? 'caracteres' : 'elementos'}`
        : `debe ser como máximo ${String(issue.maximum)}`;
    case 'too_small':
      return issue.origin === 'string' || issue.origin === 'array'
        ? `debe tener como mínimo ${String(issue.minimum)} ${issue.origin === 'string' ? 'caracteres' : 'elementos'}`
        : `debe ser como mínimo ${String(issue.minimum)}`;
    case 'invalid_format':
      return issue.message.startsWith('Invalid') ? 'formato inválido' : issue.message;
    default:
      return issue.message.startsWith('Invalid') ? 'valor inválido' : issue.message;
  }
}

/** Traduce los problemas de Zod a `{ field, reason }`, con la ruta del campo separada por puntos. */
export function toFieldErrors(issues: readonly z.core.$ZodIssue[]): ApiFieldError[] {
  return issues.flatMap((issue): ApiFieldError[] => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({
        field: [...issue.path, key].map(String).join('.'),
        reason: 'parámetro desconocido',
      }));
    }
    return [
      { field: issue.path.map(String).join('.') || 'solicitud', reason: describeIssue(issue) },
    ];
  });
}
