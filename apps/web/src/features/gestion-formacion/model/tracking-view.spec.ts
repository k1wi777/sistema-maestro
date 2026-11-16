import type { PlanTracking } from '@gns/shared';

import {
  filterTeachers,
  matrixRows,
  moduleColumnLabel,
  moduleDetailView,
  normalizeName,
  trackingIndicators,
  validModuleId,
} from './tracking-view';
import { ID } from './test-fixtures';

type Cell = PlanTracking['teachers'][number]['modules'][number];

function cell(moduleN: number, state: Cell['state'], bestScore: number | null = null): Cell {
  return {
    moduleId: ID(moduleN),
    state,
    completedAt: state === 'terminado' ? new Date('2026-11-08T15:00:00Z') : null,
    bestScore,
  };
}

function tracking(teachers: PlanTracking['teachers']): PlanTracking {
  const total = { notStarted: 0, inProgress: 0, done: 0 };
  return {
    plan: { id: ID(1), name: 'Plan', areaId: null, areaName: null, schoolYear: null },
    modules: [
      { id: ID(10), number: '1', title: 'Uno', sectionTitle: 'A', totals: total },
      { id: ID(11), number: '2', title: 'Dos', sectionTitle: 'A', totals: total },
    ],
    teachers,
  };
}

const data = tracking([
  {
    id: ID(20),
    name: 'Camila Torres',
    modules: [cell(10, 'terminado', 90), cell(11, 'terminado', 80)],
  },
  { id: ID(21), name: 'Andrés Ruiz', modules: [cell(10, 'en_curso', 60)] },
  { id: ID(22), name: 'Laura Méndez', modules: [] },
]);

describe('trackingIndicators', () => {
  it('calcula docentes, avance general, quienes terminaron todo, promedio y módulos', () => {
    expect(trackingIndicators(data)).toEqual({
      teachers: 3,
      overallPercent: 33,
      finishedAll: 1,
      averageScore: 77,
      modules: 2,
    });
  });

  it('sin docentes o sin módulos no inventa porcentajes', () => {
    expect(trackingIndicators(tracking([]))).toMatchObject({
      teachers: 0,
      overallPercent: null,
      finishedAll: 0,
      averageScore: null,
    });
    const noModules = { ...data, modules: [] };
    expect(trackingIndicators(noModules)).toMatchObject({ overallPercent: null, finishedAll: 0 });
  });
});

describe('filterTeachers y normalizeName', () => {
  it('busca sin tildes ni mayúsculas', () => {
    expect(normalizeName('  ANDRÉS ')).toBe('andres');
    expect(filterTeachers(data.teachers, 'andres').map((teacher) => teacher.name)).toEqual([
      'Andrés Ruiz',
    ]);
    expect(filterTeachers(data.teachers, 'MÉNDEZ')).toHaveLength(1);
    expect(filterTeachers(data.teachers, '')).toHaveLength(3);
    expect(filterTeachers(data.teachers, 'zzz')).toHaveLength(0);
  });
});

describe('matrixRows', () => {
  it('un estado por módulo; sin celda es «sin iniciar», y el avance del docente', () => {
    const rows = matrixRows(data, '');
    expect(rows[0]).toMatchObject({ name: 'Camila Torres', percent: 100 });
    expect(rows[1]).toMatchObject({ states: ['en_curso', 'sin_iniciar'], percent: 0 });
    expect(rows[2]).toMatchObject({ states: ['sin_iniciar', 'sin_iniciar'] });
    expect(matrixRows(data, 'camila')).toHaveLength(1);
  });

  it('la cabecera de la matriz es M<número>, o el texto si no es numérico', () => {
    expect(moduleColumnLabel({ number: '3' }, 0)).toBe('M3');
    expect(moduleColumnLabel({ number: 'A' }, 0)).toBe('A');
    expect(moduleColumnLabel({ number: null }, 4)).toBe('M5');
  });
});

describe('moduleDetailView y validModuleId', () => {
  it('muestra por docente estado, mejor puntaje y fecha de término', () => {
    const view = moduleDetailView(data, ID(10), '');
    expect(view?.module.title).toBe('Uno');
    expect(view?.rows.map((row) => [row.name, row.state, row.bestScore])).toEqual([
      ['Camila Torres', 'terminado', 90],
      ['Andrés Ruiz', 'en_curso', 60],
      ['Laura Méndez', 'sin_iniciar', null],
    ]);
    expect(view?.rows[0]?.completedAt).toEqual(new Date('2026-11-08T15:00:00Z'));
    expect(view?.rows[1]?.completedAt).toBeNull();
    expect(moduleDetailView(data, ID(99), '')).toBeNull();
  });

  it('un módulo de la URL que no está en el seguimiento se ignora', () => {
    expect(validModuleId(data, ID(11))).toBe(ID(11));
    expect(validModuleId(data, ID(99))).toBe('');
    expect(validModuleId(data, null)).toBe('');
  });
});
