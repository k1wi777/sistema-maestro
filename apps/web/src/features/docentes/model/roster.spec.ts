import { buildRoster, filterRoster, normalizeText } from './roster';
import { makeAssignment } from './test-fixtures';

const grade2 = { id: 'g-2', name: 'Segundo', sortOrder: 2 };

describe('buildRoster', () => {
  it('agrupa por docente y por grado, con grados por orden y áreas por nombre', () => {
    const roster = buildRoster([
      makeAssignment({ id: 'a', area: { id: 'x', name: 'Inglés', type: 'asignatura' } }),
      makeAssignment({ id: 'b', area: { id: 'y', name: 'Ciencias', type: 'asignatura' } }),
      makeAssignment({ id: 'c', grade: grade2, isHomeroomTeacher: true }),
    ]);
    expect(roster).toHaveLength(1);
    const [teacher] = roster;
    expect(teacher?.grades.map((grade) => grade.name)).toEqual(['Segundo', 'Tercero']);
    expect(teacher?.grades[1]?.areas.map((area) => area.name)).toEqual(['Ciencias', 'Inglés']);
    expect(teacher?.grades[0]?.isHomeroom).toBe(true);
    expect(teacher?.grades[1]?.isHomeroom).toBe(false);
  });

  it('separa las retiradas y mantiene al docente aunque todas estén retiradas', () => {
    const [teacher] = buildRoster([makeAssignment({ status: 'retirada' })]);
    expect(teacher?.grades).toEqual([]);
    expect(teacher?.withdrawnCount).toBe(1);
    expect(teacher?.unassigned).toBe(false);
  });

  it('suma como «Sin asignar» solo a las personas extra sin asignaciones y toma su rol', () => {
    const roster = buildRoster(
      [makeAssignment()],
      [
        { id: 't-1', fullName: 'Laura Demo', role: 'docente', status: 'activo' },
        { id: 't-2', fullName: 'Andrés Demo', role: 'coordinador', status: 'activo' },
      ],
    );
    expect(roster.map((item) => [item.name, item.unassigned, item.role])).toEqual([
      ['Andrés Demo', true, 'coordinador'],
      ['Laura Demo', false, 'docente'],
    ]);
  });

  it('sin personas extra no aparece nadie sin asignar', () => {
    expect(buildRoster([]).length).toBe(0);
  });
});

describe('filterRoster', () => {
  it('busca sin tildes ni mayúsculas', () => {
    const roster = buildRoster([
      makeAssignment({ teacher: { id: 't-9', fullName: 'Andrés Demo', status: 'activo' } }),
    ]);
    expect(filterRoster(roster, 'ANDRES')).toHaveLength(1);
    expect(filterRoster(roster, 'zzz')).toHaveLength(0);
    expect(filterRoster(roster, '  ')).toHaveLength(1);
    expect(normalizeText('Ñandú')).toBe('nandu');
  });
});
