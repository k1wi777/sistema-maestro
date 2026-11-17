import {
  ContributionStatus,
  JournalStatus,
  type FieldJournalDay,
  type JournalContributor,
  type JournalMissing,
} from '@gns/shared';

/** «3 de 5 docentes con anotación lista» (resumen de aportes del encabezado del director(a)). */
export function contributionSummary(ready: number, expected: number): string {
  return `${ready} de ${expected} ${expected === 1 ? 'docente' : 'docentes'} con anotación lista`;
}

/** «A, B y C»; vacío si no hay nombres. */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/**
 * Quienes aún no tienen una anotación lista, con el motivo: «Diego Herrera (en borrador) y Julián
 * Castro (sin aporte)». Es el texto de la confirmación de envío.
 */
export function pendingContributorsText(
  contributors: readonly Pick<JournalContributor, 'teacher' | 'status'>[],
): string {
  return joinNames(
    contributors
      .filter((entry) => entry.status !== ContributionStatus.Ready)
      .map(
        (entry) =>
          `${entry.teacher.fullName} (${entry.status === ContributionStatus.Draft ? 'en borrador' : 'sin aporte'})`,
      ),
  );
}

/** «Julián Castro (Música)» por cada docente sin aporte, para el aviso «Sin aporte». */
export function missingText(missing: readonly JournalMissing[]): string {
  return joinNames(
    missing.map((entry) =>
      entry.areas.length > 0
        ? `${entry.teacher.fullName} (${entry.areas.join(', ')})`
        : entry.teacher.fullName,
    ),
  );
}

/** Nombre sugerido del PDF; identifica grupo y fecha y nunca lleva nombres de estudiantes. */
export function journalPrintTitle(journal: Pick<FieldJournalDay, 'group' | 'date'>): string {
  return `Diario de campo F-PA-05 – ${journal.group.name} – ${journal.date}`;
}

/** «Coordinación dejó 1 observación a tu anotación»; `null` si no hay ninguna. */
export function myObservationsText(count: number): string | null {
  if (count <= 0) {
    return null;
  }
  return count === 1
    ? 'Coordinación dejó 1 observación a tu anotación'
    : `Coordinación dejó ${count} observaciones a tus anotaciones`;
}

/** Aviso de solo lectura: el diario enviado, revisado o anulado no admite cambios. */
export function readOnlyMessage(
  status: JournalStatus | null,
): { tone: 'info' | 'success' | 'warning'; text: string } | null {
  switch (status) {
    case JournalStatus.Submitted:
      return {
        tone: 'info',
        text: 'El diario está en revisión de coordinación: nadie puede agregar ni editar anotaciones.',
      };
    case JournalStatus.Reviewed:
      return { tone: 'success', text: 'El diario fue revisado y firmado por coordinación.' };
    case JournalStatus.Voided:
      return { tone: 'warning', text: 'El diario está anulado: no admite cambios.' };
    default:
      return null;
  }
}
