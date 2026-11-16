import type { LessonPlanCompliance } from '@gns/shared';

import { complianceRows, pickPeriod, type CompliancePeriod } from './compliance';
import { UUID_A, UUID_B, UUID_C, UUID_D } from './test-fixtures';

const PERIODS: CompliancePeriod[] = [
  { id: 'p1', number: 1, startDate: '2026-01-26', endDate: '2026-04-10' },
  { id: 'p2', number: 2, startDate: '2026-04-20', endDate: '2026-07-03' },
  { id: 'p3', number: 3, startDate: '2026-07-20', endDate: '2026-10-02' },
];

describe('pickPeriod', () => {
  it('usa el periodo pedido en el filtro', () => {
    expect(pickPeriod(PERIODS, 'p1', '2026-05-01')?.number).toBe(1);
  });

  it('sin filtro usa el periodo que contiene la fecha de hoy', () => {
    expect(pickPeriod(PERIODS, undefined, '2026-05-01')?.number).toBe(2);
  });

  it('entre periodos usa el último ya iniciado', () => {
    expect(pickPeriod(PERIODS, undefined, '2026-04-15')?.number).toBe(1);
    expect(pickPeriod(PERIODS, undefined, '2026-12-01')?.number).toBe(3);
  });

  it('antes de que empiece el año usa el primero', () => {
    expect(pickPeriod(PERIODS, undefined, '2026-01-01')?.number).toBe(1);
  });

  it('ignora un filtro que no es de los periodos y devuelve null sin periodos', () => {
    expect(pickPeriod(PERIODS, 'otro', '2026-05-01')?.number).toBe(2);
    expect(pickPeriod([], undefined, '2026-05-01')).toBeNull();
  });
});

const reference = (id: string, name: string) => ({ id, name });

function item(status: 'entregado' | 'pendiente', grade: string, area: string, period = 'p1') {
  return {
    grade: reference(UUID_A, grade),
    level: reference(UUID_B, 'Primaria'),
    area: reference(UUID_C, area),
    period: { id: period, number: 1 },
    status,
    deliveredCount: status === 'entregado' ? 1 : 0,
  } as const;
}

const COMPLIANCE: LessonPlanCompliance = {
  schoolYear: '2026',
  periods: PERIODS,
  teachers: [
    {
      teacher: { id: UUID_D, fullName: 'Zoe Demo' },
      deliveredCount: 2,
      pendingCount: 0,
      items: [item('entregado', 'Primero', 'Math'), item('entregado', 'Primero', 'Arts')],
    },
    {
      teacher: { id: UUID_C, fullName: 'Ana Demo' },
      deliveredCount: 1,
      pendingCount: 2,
      items: [
        item('entregado', 'Segundo', 'Math'),
        item('pendiente', 'Segundo', 'Arts'),
        item('pendiente', 'Tercero', 'Arts'),
        item('pendiente', 'Tercero', 'Math', 'p2'),
      ],
    },
    {
      teacher: { id: UUID_B, fullName: 'Sin Asignación' },
      deliveredCount: 0,
      pendingCount: 0,
      items: [],
    },
  ],
};

describe('complianceRows', () => {
  it('calcula entregadas, porcentaje y pendientes del periodo, ordenado por docente', () => {
    const rows = complianceRows(COMPLIANCE, 'p1');
    expect(rows.map((row) => row.teacherName)).toEqual(['Ana Demo', 'Zoe Demo']);
    expect(rows[0]).toMatchObject({
      delivered: 1,
      total: 3,
      percent: 33,
      pending: ['Segundo · Arts', 'Tercero · Arts'],
    });
  });

  it('un docente con todo entregado queda al día (sin pendientes)', () => {
    const zoe = complianceRows(COMPLIANCE, 'p1').find((row) => row.teacherName === 'Zoe Demo');
    expect(zoe).toMatchObject({ delivered: 2, total: 2, percent: 100, pending: [] });
  });

  it('omite a quien no tiene asignaciones en el periodo y solo cuenta el periodo elegido', () => {
    expect(complianceRows(COMPLIANCE, 'p2').map((row) => row.teacherName)).toEqual(['Ana Demo']);
    expect(complianceRows(COMPLIANCE, 'p3')).toEqual([]);
  });
});
