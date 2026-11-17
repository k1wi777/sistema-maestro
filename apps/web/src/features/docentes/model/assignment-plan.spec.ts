import { homeroomTargets, planAssignments, planHomeroom } from './assignment-plan';
import { makeAssignment } from './test-fixtures';

const AREA_A = { id: 'a-1', name: 'Matemáticas' };
const AREA_B = { id: 'a-2', name: 'Inglés' };

describe('planAssignments', () => {
  it('crea, reactiva u omite según lo que ya exista', () => {
    const existing = [
      makeAssignment({ id: 'x', area: { ...AREA_A, type: 'asignatura' }, status: 'activa' }),
      makeAssignment({ id: 'y', area: { ...AREA_B, type: 'asignatura' }, status: 'retirada' }),
    ];
    const steps = planAssignments(existing, 'gr-1', [
      AREA_A,
      AREA_B,
      { id: 'a-3', name: 'Ciencias' },
    ]);
    expect(steps.map((step) => step.kind)).toEqual(['skip', 'reactivate', 'create']);
    expect(steps[1]).toMatchObject({ assignmentId: 'y' });
  });

  it('no mezcla asignaciones de otro grupo, aunque sea del mismo grado', () => {
    const existing = [makeAssignment({ group: { id: 'gr-2', name: 'Tercero 2' } })];
    expect(planAssignments(existing, 'gr-1', [AREA_A])[0]?.kind).toBe('create');
  });
});

describe('homeroomTargets', () => {
  const active = [
    makeAssignment({ id: 'p', isHomeroomTeacher: false }),
    makeAssignment({ id: 'q', isHomeroomTeacher: false }),
  ];

  it('marcar usa la primera activa del grado', () => {
    expect(homeroomTargets(active, 'gr-1', true)).toEqual(['p']);
  });

  it('marcar no hace nada si ya hay una marcada o no hay activas', () => {
    expect(homeroomTargets([makeAssignment({ isHomeroomTeacher: true })], 'gr-1', true)).toEqual(
      [],
    );
    expect(homeroomTargets([makeAssignment({ status: 'retirada' })], 'gr-1', true)).toEqual([]);
  });

  it('desmarcar quita la marca de las activas que la tengan', () => {
    const items = [
      makeAssignment({ id: 'p', isHomeroomTeacher: true }),
      makeAssignment({ id: 'q', isHomeroomTeacher: false }),
    ];
    expect(homeroomTargets(items, 'gr-1', false)).toEqual(['p']);
  });
});

describe('planHomeroom', () => {
  it('pone la marca en el alta de la primera área nueva', () => {
    const steps = planAssignments([], 'gr-1', [AREA_A, AREA_B]);
    expect(planHomeroom(steps, [], 'gr-1')).toEqual({
      onCreateAreaId: 'a-1',
      afterAssignmentId: null,
    });
  });

  it('sin altas, usa la primera reactivación y, si no, una asignación activa del grupo', () => {
    const withdrawn = makeAssignment({ id: 'w', status: 'retirada' });
    const reactivate = planAssignments([withdrawn], 'gr-1', [AREA_A]);
    expect(planHomeroom(reactivate, [withdrawn], 'gr-1')).toEqual({
      onCreateAreaId: null,
      afterAssignmentId: 'w',
    });

    const active = makeAssignment({ id: 'x' });
    const skip = planAssignments([active], 'gr-1', [AREA_A]);
    expect(planHomeroom(skip, [active], 'gr-1').afterAssignmentId).toBe('x');
    expect(planHomeroom([], [], 'gr-1')).toEqual({ onCreateAreaId: null, afterAssignmentId: null });
  });
});
