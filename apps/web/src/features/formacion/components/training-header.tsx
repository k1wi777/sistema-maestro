'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { PageContainer, PageHeader, Tabs } from '@/shared/ui';

export const ROUTE_HREF = '/docente/formacion';
export const PROGRESS_HREF = '/docente/formacion/progreso';

const ROUTE_TAB = 'ruta';
const PROGRESS_TAB = 'progreso';

/**
 * Encabezado común de la ruta y de la página de progreso, con las dos pestañas «Ruta de módulos» y
 * «Mi progreso y certificados». Cada pestaña es una página: el contenido de la activa va dentro.
 */
export function TrainingPage({
  active,
  schoolYear,
  children,
}: {
  active: 'route' | 'progress';
  schoolYear?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const current = active === 'route' ? ROUTE_TAB : PROGRESS_TAB;

  return (
    <PageContainer>
      <PageHeader
        context={
          schoolYear ? `Plan de formación docente · ${schoolYear}` : 'Plan de formación docente'
        }
        title="Plan de formación"
        description="Recorre cada módulo a tu ritmo: mira el video, supera el Desafío GNS, revisa la presentación y completa las actividades. Al terminar cada módulo descargas tu certificado."
      />
      <Tabs
        label="Plan de formación"
        value={current}
        onChange={(id) => router.push(id === ROUTE_TAB ? ROUTE_HREF : PROGRESS_HREF)}
        tabs={[
          {
            id: ROUTE_TAB,
            label: 'Ruta de módulos',
            content: active === 'route' ? children : null,
          },
          {
            id: PROGRESS_TAB,
            label: 'Mi progreso y certificados',
            content: active === 'progress' ? children : null,
          },
        ]}
      />
    </PageContainer>
  );
}
