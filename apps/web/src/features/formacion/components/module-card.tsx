import type { TeacherModuleSummary } from '@gns/shared';
import Link from 'next/link';

import { Icon, StatusBadge } from '@/shared/ui';

import { MODULE_STATE_INFO } from '../model/labels';
import { moduleChips } from '../model/route';
import styles from './module-card.module.css';

export const moduleHref = (id: string): string => `/docente/formacion/modulos/${id}`;

/** Tarjeta de un módulo en la ruta: número, estado, resumen y una marca por contenido que tiene. */
export function ModuleCard({ module }: { module: TeacherModuleSummary }) {
  const state = MODULE_STATE_INFO[module.state];
  const chips = moduleChips(module);

  return (
    <li className={styles.card}>
      <div className={styles.top}>
        <span className={styles.number}>
          {module.number === null ? 'Módulo' : `Módulo ${module.number}`}
        </span>
        <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
      </div>
      <h4 className={styles.title}>
        <Link href={moduleHref(module.id)} className={styles.link}>
          {module.title}
        </Link>
      </h4>
      {module.summary ? <p className={styles.summary}>{module.summary}</p> : null}
      {chips.length > 0 ? (
        <ul className={styles.chips} aria-label="Contenidos del módulo">
          {chips.map((chip) => (
            <li key={chip.key} className={chip.done ? styles.chipDone : styles.chip}>
              {chip.done ? <Icon name="check" size={14} /> : null}
              {chip.label}
              {chip.done ? <span className="sr-only"> (listo)</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
