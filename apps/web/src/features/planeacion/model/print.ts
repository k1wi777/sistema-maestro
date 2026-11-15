import type { LessonPlan } from '@gns/shared';

/** Nombre sugerido del PDF: el navegador lo toma del título del documento al imprimir. */
export function printTitle(plan: Pick<LessonPlan, 'area' | 'topic'>): string {
  return `Planeación – ${plan.area.name} – ${plan.topic?.trim() || 'sin tema'}`;
}

/**
 * Abre el diálogo de impresión («Guardar como PDF») con `title` como título del documento y lo
 * restaura cuando termina (`afterprint`).
 */
export function printWithTitle(title: string): void {
  const previous = document.title;
  const restore = () => {
    document.title = previous;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  document.title = title;
  window.print();
}
