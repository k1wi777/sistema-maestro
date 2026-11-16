/**
 * Redirecciones de las rutas anteriores a «Planeación y PIAR como formatos». Tabla pura (sin
 * importaciones) para que `next.config.ts` la use y Jest la compruebe. Los enlaces internos de la
 * web ya apuntan a las rutas nuevas; esto solo protege enlaces guardados.
 */
export interface LegacyRedirect {
  source: string;
  destination: string;
  /** Condiciones sobre la cadena de consulta (formato de `redirects()` de Next). */
  has?: { type: 'query'; key: string; value?: string }[];
  missing?: { type: 'query'; key: string; value?: string }[];
  /** Ruta antigua de ejemplo que debe quedar cubierta (la usan las pruebas). */
  example: string;
  /** Ruta de destino de ese ejemplo, sin consulta. */
  exampleTarget: string;
}

// Temporales (307): en esta fase no hay producción y no conviene que el navegador las fije.
export const LEGACY_REDIRECTS: readonly LegacyRedirect[] = [
  {
    source: '/docente/planeacion',
    destination: '/docente/formatos/planeacion',
    example: '/docente/planeacion',
    exampleTarget: '/docente/formatos/planeacion',
  },
  {
    source: '/docente/planeacion/:path*',
    destination: '/docente/formatos/planeacion/:path*',
    example: '/docente/planeacion/nueva',
    exampleTarget: '/docente/formatos/planeacion/nueva',
  },
  {
    source: '/coordinacion/planeaciones',
    destination: '/coordinacion/formatos/planeaciones',
    example: '/coordinacion/planeaciones',
    exampleTarget: '/coordinacion/formatos/planeaciones',
  },
  {
    source: '/coordinacion/planeaciones/:path*',
    destination: '/coordinacion/formatos/planeaciones/:path*',
    example: '/coordinacion/planeaciones/abc',
    exampleTarget: '/coordinacion/formatos/planeaciones',
  },
  {
    source: '/docente/formatos',
    has: [{ type: 'query', key: 'pestana', value: 'observador' }],
    destination: '/docente/formatos/observador',
    example: '/docente/formatos?pestana=observador',
    exampleTarget: '/docente/formatos/observador',
  },
  {
    source: '/docente/formatos',
    has: [{ type: 'query', key: 'estado' }],
    missing: [{ type: 'query', key: 'pestana' }],
    destination: '/docente/formatos/diario',
    example: '/docente/formatos?estado=enviada',
    exampleTarget: '/docente/formatos/diario',
  },
  {
    source: '/coordinacion/formatos',
    has: [{ type: 'query', key: 'tipo', value: 'observador' }],
    destination: '/coordinacion/formatos/observador',
    example: '/coordinacion/formatos?tipo=observador',
    exampleTarget: '/coordinacion/formatos/observador',
  },
  {
    source: '/coordinacion/formatos',
    has: [{ type: 'query', key: 'tipo', value: 'diario' }],
    destination: '/coordinacion/formatos/diario',
    example: '/coordinacion/formatos?tipo=diario',
    exampleTarget: '/coordinacion/formatos/diario',
  },
  {
    source: '/coordinacion/formatos',
    has: [{ type: 'query', key: 'estado' }],
    missing: [{ type: 'query', key: 'tipo' }],
    destination: '/coordinacion/formatos/diario',
    example: '/coordinacion/formatos?estado=enviada',
    exampleTarget: '/coordinacion/formatos/diario',
  },
];

/** Reglas en el formato de `redirects()` de Next (sin los campos de ejemplo). */
export function nextRedirects() {
  return LEGACY_REDIRECTS.map(({ source, destination, has, missing }) => ({
    source,
    destination,
    permanent: false as const,
    ...(has ? { has } : {}),
    ...(missing ? { missing } : {}),
  }));
}
