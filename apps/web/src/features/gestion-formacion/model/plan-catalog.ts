import type { TrainingPlanSummary } from '@gns/shared';

export interface AreaRef {
  id: string;
  name: string;
}

/**
 * Una opción del selector de «Planes de formación»: un plan existente (General o de un área) o un
 * área que todavía no tiene plan (el primer módulo lo crea).
 */
export interface PlanOption {
  /** Id del plan, o `area:<id>` si el área no tiene plan. */
  key: string;
  label: string;
  plan: TrainingPlanSummary | null;
  /** Área de la opción; `null` en el plan General. */
  area: AreaRef | null;
}

function moduleTotal(plan: TrainingPlanSummary): number {
  const { draft, active, outOfPlan } = plan.moduleCounts;
  return draft + active + outOfPlan;
}

function modulesText(total: number): string {
  return total === 1 ? '1 módulo' : `${total} módulos`;
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, 'es');
}

function withYear(label: string, plan: TrainingPlanSummary, shared: boolean): string {
  return shared ? `${label} · ${plan.schoolYear ?? 'todos los años'}` : label;
}

/**
 * Une planes y áreas en las opciones del selector: el plan General primero y luego las áreas por
 * nombre. Un área sin plan aparece como opción «sin módulos»; si un área tuviera varios planes (por
 * año lectivo), cada plan es su propia opción con el año.
 */
export function buildPlanOptions(
  plans: readonly TrainingPlanSummary[],
  areas: readonly AreaRef[],
): PlanOption[] {
  const options: PlanOption[] = [];

  const general = plans.filter((plan) => plan.areaId === null);
  for (const plan of general) {
    options.push({
      key: plan.id,
      label: withYear(`General · ${plan.name}`, plan, general.length > 1),
      plan,
      area: null,
    });
  }

  for (const area of [...areas].sort(byName)) {
    const ofArea = plans.filter((plan) => plan.areaId === area.id);
    if (ofArea.length === 0) {
      options.push({
        key: `area:${area.id}`,
        label: `${area.name} (sin módulos)`,
        plan: null,
        area,
      });
      continue;
    }
    for (const plan of ofArea) {
      options.push({
        key: plan.id,
        label: withYear(
          `${area.name} (${modulesText(moduleTotal(plan))})`,
          plan,
          ofArea.length > 1,
        ),
        plan,
        area,
      });
    }
  }
  return options;
}

/** La opción que pide la URL (`plan` o `area`) o, si no existe, la primera. */
export function pickPlanOption(
  options: readonly PlanOption[],
  selection: { plan: string | null; area: string | null },
): PlanOption | null {
  const requested =
    (selection.plan ? options.find((option) => option.plan?.id === selection.plan) : undefined) ??
    (selection.area ? options.find((option) => option.area?.id === selection.area) : undefined);
  return requested ?? options[0] ?? null;
}

/** Parámetros de la URL que identifican una opción. */
export function optionToParams(option: PlanOption): { plan: string | null; area: string | null } {
  return option.plan
    ? { plan: option.plan.id, area: null }
    : { plan: null, area: option.area?.id ?? null };
}

/** La opción cuya clave (`key`) es la del selector. */
export function optionByKey(options: readonly PlanOption[], key: string): PlanOption | null {
  return options.find((option) => option.key === key) ?? null;
}
