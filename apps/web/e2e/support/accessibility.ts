import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;
type Violation = AxeResults['violations'][number];

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/** Reglas de estructura que hacen fallar aunque su impacto sea moderado (R2). */
const STRUCTURE_RULES = new Set(['page-has-heading-one', 'heading-order', 'landmark-one-main']);

/** Impactos que hacen fallar (R1). */
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

/**
 * Exclusiones de la revisión: el único lugar donde se admiten (R3). Solo falsos positivos
 * demostrados, siempre con su regla, el elemento y el motivo; una infracción real se corrige.
 */
export const ACCESSIBILITY_EXCLUSIONS: readonly {
  rule: string;
  selector: string;
  reason: string;
}[] = [];

function isBlocking(violation: Violation): boolean {
  return BLOCKING_IMPACTS.has(violation.impact ?? '') || STRUCTURE_RULES.has(violation.id);
}

/** Quita de cada infracción los elementos que la lista de exclusiones declara como falso positivo. */
function withoutExclusions(violations: Violation[]): Violation[] {
  return violations
    .map((violation) => ({
      ...violation,
      nodes: violation.nodes.filter(
        (node) =>
          !ACCESSIBILITY_EXCLUSIONS.some(
            (exclusion) =>
              exclusion.rule === violation.id && node.target.join(' ').includes(exclusion.selector),
          ),
      ),
    }))
    .filter((violation) => violation.nodes.length > 0);
}

function describe(violation: Violation): string {
  const nodes = violation.nodes
    .slice(0, 5)
    .map((node) => `    ${node.target.join(' ')}\n      ${node.html.slice(0, 160)}`)
    .join('\n');
  return `[${violation.impact ?? 'sin impacto'}] ${violation.id}: ${violation.help} (${violation.nodes.length})\n${nodes}`;
}

/**
 * Pasa la pantalla actual por axe-core (WCAG 2.0/2.1/2.2 A y AA y buenas prácticas) en los temas
 * claro y oscuro. Falla ante infracciones graves, críticas o de estructura; informa el resto.
 */
export async function expectAccessible(
  page: Page,
  label: string,
  schemes: readonly ('light' | 'dark')[] = ['light', 'dark'],
): Promise<void> {
  for (const scheme of schemes) {
    // Se mide sin transiciones: al cambiar de tema, axe calcularía el contraste con colores
    // intermedios (texto ya en el tema nuevo y fondo aún animándose), sobre todo en la CI.
    // `base.css` reduce las transiciones con `prefers-reduced-motion`.
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.evaluate(`new Promise((done) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(async () => {
          const pending = document
            .getAnimations()
            .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime ?? 0));
          await Promise.allSettled(pending.map((animation) => animation.finished));
          done(null);
        }),
      );
    })`);
    const where = `${label} (${scheme})`;

    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    const violations = withoutExclusions(results.violations);

    const failing = violations.filter(isBlocking);
    const reported = violations.filter((violation) => !isBlocking(violation));

    if (reported.length > 0) {
      const lines = reported.map(
        (violation) =>
          `${where}: [${violation.impact ?? '-'}] ${violation.id} (${violation.nodes.length}) ${violation.nodes
            .slice(0, 3)
            .map((node) => node.target.join(' '))
            .join(' | ')}`,
      );
      console.log(`Accesibilidad (sin fallar)\n${lines.join('\n')}`);
      await test.info().attach(`axe-no-bloqueantes ${where}`, {
        body: reported.map(describe).join('\n'),
        contentType: 'text/plain',
      });
    }
    expect(failing.map(describe).join('\n'), `Infracciones de accesibilidad en ${where}`).toBe('');
  }
  await page.emulateMedia({ colorScheme: null, reducedMotion: null });
}

/** La página no se desplaza en horizontal (R4). */
export async function expectNoHorizontalScroll(page: Page, label: string): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate<{
    scrollWidth: number;
    innerWidth: number;
  }>('({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })');
  expect(
    scrollWidth,
    `Desplazamiento horizontal en ${label} (${innerWidth} px)`,
  ).toBeLessThanOrEqual(innerWidth);
}
