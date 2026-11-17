import type { AcademicStructure } from '@gns/shared';

import {
  compareNatural,
  filterAreas,
  gradesOfCoordinator,
  gradesWithoutCoordinator,
  levelNamesOf,
  nextGradeOrder,
  nextGroupName,
  parseGradeOrder,
  removeDecision,
} from './structure';

const person = { id: 'c-1', fullName: 'Elena Demo' };
const group = (name: string) => ({
  id: name,
  name,
  active: true,
  inUse: false,
  homeroomTeacher: null,
});

const structure: AcademicStructure = {
  schoolYear: '2026-2027',
  levels: [
    {
      id: 'l-1',
      name: 'Preescolar',
      sortOrder: 1,
      grades: [
        {
          id: 'g-1',
          name: 'Red',
          sortOrder: 1,
          active: true,
          coordinator: person,
          inUse: true,
          groups: [group('Red 1'), group('Red 2')],
        },
        {
          id: 'g-2',
          name: 'First Grade',
          sortOrder: 2,
          active: true,
          coordinator: null,
          inUse: false,
          groups: [],
        },
        {
          id: 'g-3',
          name: 'Viejo',
          sortOrder: 3,
          active: false,
          coordinator: null,
          inUse: true,
          groups: [],
        },
      ],
    },
  ],
  areas: [
    { id: 'a-1', name: 'Math', type: 'asignatura', active: true, levelIds: ['l-1'], usageCount: 2 },
    {
      id: 'a-2',
      name: 'Pre-ciencias',
      type: 'dimension',
      active: true,
      levelIds: [],
      usageCount: 0,
    },
  ],
  coordinators: [{ ...person, gradeIds: ['g-1'] }],
};

describe('nextGroupName', () => {
  it('propone el siguiente número del grado', () => {
    const [red] = structure.levels[0]!.grades;
    expect(nextGroupName(red!)).toBe('Red 3');
  });

  it('empieza en 1 sin grupos y nunca repite un nombre existente', () => {
    expect(nextGroupName({ name: 'First Grade', groups: [] })).toBe('First Grade 1');
    expect(nextGroupName({ name: 'Kinder', groups: [group('Kinder 1'), group('Kinder 10')] })).toBe(
      'Kinder 11',
    );
    expect(nextGroupName({ name: 'Kinder', groups: [group('Salón verde')] })).toBe('Kinder 2');
  });
});

describe('gradesWithoutCoordinator', () => {
  it('lista solo los grados activos sin coordinadora', () => {
    expect(gradesWithoutCoordinator(structure).map((grade) => grade.name)).toEqual(['First Grade']);
  });
});

describe('filterAreas', () => {
  it('filtra por tipo y por nivel', () => {
    expect(filterAreas(structure.areas, { type: '', levelId: '' })).toHaveLength(2);
    expect(filterAreas(structure.areas, { type: 'dimension', levelId: '' })).toHaveLength(1);
    expect(filterAreas(structure.areas, { type: '', levelId: 'l-1' }).map((a) => a.id)).toEqual([
      'a-1',
    ]);
  });
});

describe('orden de los grados', () => {
  it('propone el siguiente al mayor existente', () => {
    expect(nextGradeOrder(structure)).toBe(4);
    expect(nextGradeOrder({ ...structure, levels: [] })).toBe(1);
  });

  it('acepta enteros de 1 a 32767 y rechaza el resto', () => {
    expect(parseGradeOrder(' 7 ')).toBe(7);
    expect(parseGradeOrder('32767')).toBe(32767);
    for (const bad of ['', '0', '1.5', '-2', 'abc', '32768']) {
      expect(parseGradeOrder(bad)).toBeNull();
    }
  });
});

describe('otros ayudantes', () => {
  it('ordena de forma natural, rotula niveles y decide borrar o desactivar', () => {
    expect(['Kinder 10', 'Kinder 2'].sort(compareNatural)).toEqual(['Kinder 2', 'Kinder 10']);
    expect(levelNamesOf(structure.areas[0]!, structure.levels)).toBe('Preescolar');
    expect(removeDecision(true)).toBe('deactivate');
    expect(removeDecision(false)).toBe('delete');
  });

  it('une a la coordinadora con sus grados', () => {
    const grades = gradesOfCoordinator(structure, structure.coordinators[0]!);
    expect(grades.map((grade) => grade.name)).toEqual(['Red']);
  });
});
