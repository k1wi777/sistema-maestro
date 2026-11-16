import type { Locator, Page } from '@playwright/test';

/**
 * Insignia de estado de un registro: vive en el encabezado de la pantalla. Así el localizador es
 * único aunque el mismo texto aparezca en otros lugares (resúmenes, historial, hoja de impresión).
 */
export function statusBadge(page: Page, label: string): Locator {
  return page.locator('main header').getByText(label, { exact: true });
}
