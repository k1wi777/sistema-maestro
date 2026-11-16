import type { FillableIconName } from '@/shared/ui';

import { FORMATS_HUB_PATH, JOURNAL_LIST_PATH, OBSERVER_LIST_PATH } from './paths';

export interface FormatCardData {
  id: string;
  title: string;
  description: string;
  icon: FillableIconName;
  /** Sin `href` la tarjeta es informativa («Pronto»). */
  href?: string;
  soon?: boolean;
}

/** Formatos del docente, en el orden del hub (`/docente/formatos`). */
export const FORMAT_CARDS: readonly FormatCardData[] = [
  {
    id: 'planeacion',
    title: 'Planeación GNS',
    description: 'Planea tus clases con el modelo GNS y envíalas a revisión.',
    icon: 'plan',
    href: `${FORMATS_HUB_PATH}/planeacion`,
  },
  {
    id: 'diario',
    title: 'Diario de campo (F-PA-05)',
    description: 'Registra los eventos de tus clases y envía cada hoja a coordinación.',
    icon: 'formatos',
    href: JOURNAL_LIST_PATH,
  },
  {
    id: 'observador',
    title: 'Observador del estudiante',
    description: 'Registra anotaciones de convivencia y seguimiento.',
    icon: 'formatos',
    href: OBSERVER_LIST_PATH,
  },
  {
    id: 'piar',
    title: 'PIAR · Inclusión',
    description: 'Llegará en una etapa posterior.',
    icon: 'piar',
    soon: true,
  },
];
