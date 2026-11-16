import { homeroomTargets, planAssignments } from './assignment-plan';
import { makeAssignment } from './test-fixtures';

const AREA_A = { id: 'a-1', name: 'Matemáticas' };
const AREA_B = { id: 'a-2', name: 'Inglés' };

describe('planAssignments', () => {
  it('crea, reactiva u omite según lo que ya exista', () => {
    const existing = [
      makeAssignment({ id: 'x', area: { ...AREA_A, type: 'asignatura' }, status: 'activa' }),
      makeAssignment({ id: 'y', area: { ...AREA_B, type: 'asignatura' }, status: 'retirada' }),
    ];
    const steps = planAssignments(existing, 'g-1', [
      AREA_A,
      AREA_B,
      { id: 'a-3', name: 'Ciencias' },
    ]);
    expect(steps.map((step) => step.kind)).toEqual(['skip', 'reactivate', 'create']);
    expect(steps[1]).toMatchObject({ assignmentId: 'y' });
  });

  it('no mezcla asignaciones de otro grado', () => {
    const existing = [makeAssignment({ grade: { id: 'g-2', name: 'Segundo', sortOrder: 2 } })];
    expect(planAssignments(existing, 'g-1', [AREA_A])[0]?.kind).toBe('create');
  });
});

describe('homeroomTargets', () => {
  const active = [
    makeAssignment({ id: 'p', isHomeroomTeacher: false }),
    makeAssignment({ id: 'q', isHomeroomTeacher: false }),
  ];

  it('marcar usa la primera activa del grado', () => {
    expect(homeroomTargets(active, 'g-1', true)).toEqual(['p']);
  });

  it('marcar no hace nada si ya hay una marcada o no hay activas', () => {
    expect(homeroomTargets([makeAssignment({ isHomeroomTeacher: true })], 'g-1', true)).toEqual([]);
    expect(homeroomTargets([makeAssignment({ status: 'retirada' })], 'g-1', true)).toEqual([]);
  });

  it('desmarcar quita la marca de las activas que la tengan', () => {
    const items = [
      makeAssignment({ id: 'p', isHomeroomTeacher: true }),
      makeAssignment({ id: 'q', isHomeroomTeacher: false }),
    ];
    expect(homeroomTargets(items, 'g-1', false)).toEqual(['p']);
  });
});
