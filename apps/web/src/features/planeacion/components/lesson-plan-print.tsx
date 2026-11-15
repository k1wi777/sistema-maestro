import { crossCuttingProjectFor, type LessonPlan } from '@gns/shared';

import { formatDateRange, formatDateTime } from '@/shared/format/dates';
import { BrandMark } from '@/shared/ui';

import { MOMENTS } from '../model/steps';
import { STATUS_INFO } from '@/shared/records';
import styles from './lesson-plan-print.module.css';

function Section({ title, text }: { title: string; text: string | null }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{title}</h2>
      <p className={styles.text}>{text?.trim() ? text : 'Sin contenido.'}</p>
    </section>
  );
}

/**
 * Hoja de impresión de la planeación («Exportar PDF»): existe siempre en la página pero solo se ve
 * al imprimir. Lleva la identidad del colegio y todos los campos y enlaces, sin controles.
 */
export function LessonPlanPrint({ plan }: { plan: LessonPlan }) {
  const dates = formatDateRange(plan.dateFrom, plan.dateTo);
  const project =
    plan.crossCuttingProject ?? crossCuttingProjectFor(plan.level.name, plan.period.number);

  return (
    <article className={styles.sheet} aria-hidden="true">
      <header className={styles.header}>
        <BrandMark tagline="Montería · Colombia" />
        <p className={styles.kind}>Planeación GNS</p>
      </header>
      <h1 className={styles.title}>{plan.topic?.trim() || 'Sin tema'}</h1>
      <dl className={styles.facts}>
        <div>
          <dt>Docente</dt>
          <dd>{plan.teacher.fullName}</dd>
        </div>
        <div>
          <dt>Nivel</dt>
          <dd>{plan.level.name}</dd>
        </div>
        <div>
          <dt>Grado</dt>
          <dd>{plan.grade.name}</dd>
        </div>
        <div>
          <dt>Área</dt>
          <dd>{plan.area.name}</dd>
        </div>
        <div>
          <dt>Periodo</dt>
          <dd>{`Periodo ${plan.period.number} · ${plan.period.schoolYear}`}</dd>
        </div>
        <div>
          <dt>Fechas</dt>
          <dd>{dates ?? 'Sin fechas'}</dd>
        </div>
        <div>
          <dt>Proyecto transversal</dt>
          <dd>{project ?? 'Sin proyecto'}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{STATUS_INFO[plan.status].label}</dd>
        </div>
      </dl>

      <Section title="Desempeño esperado" text={plan.expectedPerformance} />
      {plan.curiocityStage ? (
        <Section title="Etapa CurioCity" text={plan.curiocityStage} />
      ) : (
        <Section title="Rincón o zona" text={plan.learningCorner} />
      )}
      {MOMENTS.map((moment) => (
        <Section
          key={moment.field}
          title={`Momento ${moment.number} · ${moment.title}`}
          text={plan[moment.field]}
        />
      ))}
      <Section title="Recursos y materiales" text={plan.resources} />
      <Section title="Ajustes razonables" text={plan.reasonableAdjustments} />

      <section className={styles.section}>
        <h2 className={styles.heading}>Recursos digitales</h2>
        {plan.linkedResources.length === 0 ? (
          <p className={styles.text}>Sin enlaces.</p>
        ) : (
          <ul className={styles.links}>
            {plan.linkedResources.map((resource) => (
              <li key={resource.id}>
                <b>{resource.name ?? resource.tool}</b> · {resource.tool}
                {resource.moment ? ` · Momento ${resource.moment}` : ''}
                <br />
                <span className={styles.url}>{resource.url}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className={styles.footer}>
        {[
          plan.submittedAt ? `Enviada a coordinación el ${formatDateTime(plan.submittedAt)}` : null,
          'Documento generado desde la Plataforma GNS',
        ]
          .filter(Boolean)
          .join('. ')}
        .
      </footer>
    </article>
  );
}
