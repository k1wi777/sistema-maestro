import type { FillableIconName, IconName } from '@/shared/ui';

import type { ProtectedRoute } from '../session/route-access';

/** Sección del menú lateral. Sin `href`, la sección aún no existe y se muestra «pronto». */
export interface NavSection {
  href?: string;
  label: string;
  icon: IconName;
  /** Qué hará la sección: lo muestra la página de marcador hasta que se construya. */
  description: string;
  soon?: boolean;
}

export interface NavGroup {
  /** Rótulo del grupo; sin él, las secciones van sueltas. */
  title?: string;
  sections: readonly NavSection[];
}

/** Una de las dos vistas de la plataforma: su título, su tarjeta de selección y su menú. */
export interface ViewConfig {
  path: ProtectedRoute;
  title: string;
  /** Texto de la tarjeta en la selección de vista. */
  description: string;
  icon: FillableIconName;
  groups: readonly NavGroup[];
}

export const VIEWS: Record<ProtectedRoute, ViewConfig> = {
  '/docente': {
    path: '/docente',
    title: 'Panel Docente',
    description: 'Planeaciones, formatos y plan de formación',
    icon: 'plan',
    groups: [
      {
        sections: [
          {
            href: '/docente/formacion',
            label: 'Plan de formación',
            icon: 'ruta',
            description:
              'Tu ruta de formación docente: inducción, módulos, Desafío GNS y certificados.',
          },
          {
            href: '/docente/formatos',
            label: 'Formatos',
            icon: 'formatos',
            description: 'Planeación GNS, diario de campo, observador y PIAR.',
          },
          {
            href: '/docente/asistente',
            label: 'Asistente GNS',
            icon: 'chat',
            description: 'Resuelve tus dudas con las preguntas frecuentes de la plataforma.',
          },
        ],
      },
    ],
  },
  '/coordinacion': {
    path: '/coordinacion',
    title: 'Coordinación académica',
    description: 'Revisión, bitácora y planes de formación',
    icon: 'ojo',
    groups: [
      {
        title: 'Seguimiento',
        sections: [
          {
            href: '/coordinacion/formatos',
            label: 'Formatos',
            icon: 'formatos',
            description: 'Revisa planeaciones, diarios de campo y observadores.',
          },
          {
            href: '/coordinacion/bitacora',
            label: 'Bitácora de actividad',
            icon: 'bitacora',
            description: 'Consulta la bitácora de actividad de la plataforma.',
          },
        ],
      },
      {
        title: 'Gestión',
        sections: [
          {
            href: '/coordinacion/docentes',
            label: 'Docentes y asignaciones',
            icon: 'gente',
            description: 'Gestiona los docentes, sus grados, áreas y asignaciones.',
          },
          {
            href: '/coordinacion/grados-y-areas',
            label: 'Grados y áreas',
            icon: 'grados',
            description: 'Organiza grados, grupos, áreas y coordinadoras.',
          },
          {
            href: '/coordinacion/planes',
            label: 'Planes de formación',
            icon: 'ruta',
            description: 'Crea y gestiona los planes de formación por área.',
          },
          {
            href: '/coordinacion/avance',
            label: 'Avance en la formación',
            icon: 'grafica',
            description: 'Sigue el avance de los docentes en su formación.',
          },
          {
            href: '/coordinacion/asistente',
            label: 'Asistente',
            icon: 'chat',
            description:
              'Gestiona las preguntas frecuentes del asistente y atiende las preguntas sin respuesta.',
          },
        ],
      },
    ],
  },
};

export type LinkedSection = NavSection & { href: string };

/** Todas las secciones con página de una vista, en el orden del menú. */
export function sectionsOf(view: ViewConfig): LinkedSection[] {
  return view.groups
    .flatMap((group) => group.sections)
    .filter((section): section is LinkedSection => section.href !== undefined);
}

/** La sección y la vista que corresponden a una ruta de página; falla si el menú no la declara. */
export function sectionByHref(href: string): { view: ViewConfig; section: LinkedSection } {
  for (const view of Object.values(VIEWS)) {
    const section = sectionsOf(view).find((candidate) => candidate.href === href);
    if (section) {
      return { view, section };
    }
  }
  throw new Error(`La ruta ${href} no está en el menú.`);
}

/** Primera sección con página de una vista: a donde lleva `/docente` o `/coordinacion`. */
export function firstSectionHref(view: ViewConfig): string {
  const first = sectionsOf(view)[0];
  if (!first) {
    throw new Error(`La vista ${view.path} no tiene secciones.`);
  }
  return first.href;
}

/** La sección está activa si la ruta es la suya o una subruta (por segmento, no por prefijo de texto). */
export function isActiveSection(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
