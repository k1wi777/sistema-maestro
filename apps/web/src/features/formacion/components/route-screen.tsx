'use client';

import type { TeacherRoute } from '@gns/shared';

import { LoadError, Loading } from '@/shared/data';
import { ButtonLink, Notice } from '@/shared/ui';

import { useTrainingRoute } from '../hooks/use-training-route';
import { routeOverview } from '../model/route';
import { ModuleCard, moduleHref } from './module-card';
import styles from './route-screen.module.css';
import { TrainingPage } from './training-header';

function Overview({ route }: { route: TeacherRoute }) {
  const overview = routeOverview(route);
  return (
    <>
      <div className={styles.summary}>
        <p className={styles.count}>
          <b>{overview.completed}</b>
          <span>{`de ${overview.total} módulos terminados`}</span>
        </p>
        <div
          className={styles.bar}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={overview.percent}
          aria-label="Avance de la ruta"
        >
          <span style={{ width: `${overview.percent}%` }} />
        </div>
        <span className={styles.percent}>{`${overview.percent}%`}</span>
      </div>
      {overview.continueModule ? (
        <div className={styles.continue}>
          <p>
            <strong>Continuar donde quedaste</strong>
            <span className={styles.continueLabel}>{overview.continueModule.label}</span>
          </p>
          <ButtonLink href={moduleHref(overview.continueModule.id)} endIcon="siguiente">
            Continuar
          </ButtonLink>
        </div>
      ) : null}
    </>
  );
}

function Plans({ route }: { route: TeacherRoute }) {
  return (
    <>
      {route.plans.map((plan) => (
        <section key={plan.id} className={styles.plan} aria-labelledby={`plan-${plan.id}`}>
          <h2 id={`plan-${plan.id}`} className={styles.planTitle}>
            {plan.name}
          </h2>
          {plan.sections.map((section) => (
            <div key={section.id} className={styles.part}>
              <h3 className={styles.partTitle}>{section.title}</h3>
              {section.subtitle ? <p className={styles.partSubtitle}>{section.subtitle}</p> : null}
              <ul className={styles.modules}>
                {section.modules.map((module) => (
                  <ModuleCard key={module.id} module={module} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

/** «Ruta de módulos»: avance general, «Continuar donde quedaste» y los planes con sus partes. */
export function TrainingRouteScreen() {
  const { state, reload } = useTrainingRoute();

  if (state.status === 'loading') {
    return (
      <TrainingPage active="route">
        <Loading>Cargando tu ruta de formación…</Loading>
      </TrainingPage>
    );
  }
  if (state.status === 'error') {
    return (
      <TrainingPage active="route">
        <LoadError error={state.error} onRetry={reload} />
      </TrainingPage>
    );
  }

  const route = state.data;
  return (
    <TrainingPage active="route" schoolYear={route.schoolYear}>
      {routeOverview(route).isEmpty ? (
        <Notice tone="info" title="Aún no tienes módulos en tu ruta">
          Coordinación académica asigna los planes de formación según tu área. Cuando tengas
          módulos, aparecerán aquí con tu avance.
        </Notice>
      ) : (
        <>
          <Overview route={route} />
          <Plans route={route} />
        </>
      )}
    </TrainingPage>
  );
}
