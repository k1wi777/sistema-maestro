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
 * Espera a que terminen las animaciones que axe puede ver, sin depender de `animation.finished`:
 * en un `<details>` cerrado el contenido está omitido (`content-visibility: hidden`) y Chromium
 * nunca resuelve esa promesa, aunque el reloj de la transición ya haya avanzado. Se sondea el
 * estado (`playState`) fotograma a fotograma, solo en animaciones de elementos renderizados. Si
 * alguna está en pausa, o se supera el tiempo que le queda más un margen para que el navegador arranque las pendientes, falla
 * con la pantalla, el elemento y la propiedad en lugar de agotar el tiempo de la prueba.
 */
async function waitForAnimations(page: Page, where: string): Promise<void> {
  await page.evaluate(`new Promise((resolve, reject) => {
    const where = ${JSON.stringify(where)};
    // Techo (no una espera): el compositor puede tardar casi un segundo en arrancar las
    // animaciones pendientes tras el cambio de tema; la espera acaba en cuanto todas terminan.
    const START_MARGIN_MS = 5000;
    let deadline = null;
    const relevant = () =>
      document.getAnimations().filter((animation) => {
        const target = animation.effect?.target;
        const end = animation.effect?.getComputedTiming().endTime ?? 0;
        return target && Number.isFinite(end) && target.checkVisibility();
      });
    const describe = (animation) => {
      const target = animation.effect.target;
      const name = animation.transitionProperty ?? animation.animationName ?? (animation.id || 'sin nombre');
      return target.tagName.toLowerCase() + '.' + String(target.className) + ' [' + name + '] ' + animation.playState + ' pend=' + animation.pending;
    };
    const fail = (reason, list) =>
      reject(new Error('Animaciones ' + reason + ' en ' + where + ': ' + list.map(describe).join(', ')));
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const tick = () => {
          try {
          const list = relevant();
          const paused = list.filter((animation) => animation.playState === 'paused');
          if (paused.length > 0) return fail('en pausa (no terminarían)', paused);
          const active = list.filter((animation) => animation.playState === 'running' || animation.pending);
          if (active.length === 0) return resolve(null);
          if (deadline === null) {
            const remaining = Math.max(
              ...active.map(
                (animation) =>
                  (animation.effect.getComputedTiming().endTime - (animation.currentTime ?? 0)) /
                  Math.abs(animation.playbackRate || 1),
              ),
            );
            deadline = performance.now() + Math.max(remaining, 0) + START_MARGIN_MS;
          } else if (performance.now() > deadline) {
            return fail('sin terminar', active);
          }
          requestAnimationFrame(tick);
          } catch (error) {
            reject(error);
          }
        };
        tick();
      }),
    );
  })`);
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
    const where = `${label} (${scheme})`;
    await waitForAnimations(page, where);

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
