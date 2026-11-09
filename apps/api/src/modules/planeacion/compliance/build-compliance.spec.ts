import { AreaType, TeacherAssignmentStatus, UserStatus } from '@gns/shared';
import type { AcademicPeriod, TeacherAssignment } from '@gns/shared';
import type { DeliveredCount } from '../lesson-plans/lesson-plan.repository';
import { buildCompliance } from './build-compliance';

const NOW = new Date('2026-11-09T00:00:00Z');

const period = (number: number): AcademicPeriod => ({
  id: `p-${number}`,
  schoolYear: '2026-2027',
  number,
  startDate: null,
  endDate: null,
  createdAt: NOW,
  updatedAt: NOW,
});

function assignment(
  teacher: string,
  grade: [string, number],
  area: string,
  id = `${teacher}-${grade[0]}-${area}`,
): TeacherAssignment {
  return {
    id,
    schoolYear: '2026-2027',
    status: TeacherAssignmentStatus.Active,
    isHomeroomTeacher: false,
    teacher: { id: teacher, fullName: `Docente ${teacher}`, status: UserStatus.Active },
    grade: { id: grade[0], name: grade[0], sortOrder: grade[1] },
    level: { id: 'l-1', name: 'Primaria' },
    area: { id: area, name: area, type: AreaType.Subject },
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const delivered = (
  teacherId: string,
  gradeId: string,
  areaId: string,
  periodId: string,
  count = 1,
): DeliveredCount => ({ teacherId, gradeId, areaId, periodId, count });

const periods = [period(1), period(2)];

function first<T>(items: readonly T[]): T {
  const [item] = items;
  if (item === undefined) {
    throw new Error('Se esperaba al menos un elemento');
  }
  return item;
}

describe('buildCompliance', () => {
  it('crea una celda por asignación y periodo, pendiente sin entregas', () => {
    const entry = first(buildCompliance(periods, [assignment('a', ['g1', 1], 'mat')], []));

    expect(entry.items).toHaveLength(2);
    expect(entry.items.map((item) => item.status)).toEqual(['pendiente', 'pendiente']);
    expect(entry).toMatchObject({ deliveredCount: 0, pendingCount: 2 });
  });

  it('marca entregado con al menos una planeación y cuenta cuántas', () => {
    const entry = first(
      buildCompliance(
        periods,
        [assignment('a', ['g1', 1], 'mat')],
        [delivered('a', 'g1', 'mat', 'p-2', 3)],
      ),
    );

    expect(first(entry.items)).toMatchObject({ period: { number: 1 }, status: 'pendiente' });
    expect(entry.items.at(1)).toMatchObject({
      period: { number: 2 },
      status: 'entregado',
      deliveredCount: 3,
    });
    expect(entry).toMatchObject({ deliveredCount: 1, pendingCount: 1 });
  });

  it('ignora entregas sin asignación activa (retirada, otro grado u otro docente)', () => {
    const teachers = buildCompliance(
      periods,
      [assignment('a', ['g1', 1], 'mat')],
      [
        delivered('a', 'g1', 'cien', 'p-1'),
        delivered('a', 'g2', 'mat', 'p-1'),
        delivered('b', 'g1', 'mat', 'p-1'),
      ],
    );

    expect(teachers).toHaveLength(1);
    expect(first(teachers).items.every((item) => item.deliveredCount === 0)).toBe(true);
  });

  it('ordena docentes por nombre y celdas por grado, área y periodo', () => {
    const teachers = buildCompliance(
      periods,
      [
        assignment('z', ['g1', 1], 'mat'),
        assignment('a', ['g5', 5], 'arte'),
        assignment('a', ['g1', 1], 'cien'),
        assignment('a', ['g1', 1], 'bio'),
      ],
      [],
    );

    expect(teachers.map((entry) => entry.teacher.id)).toEqual(['a', 'z']);
    expect(
      first(teachers).items.map((item) => `${item.grade.id}/${item.area.id}/${item.period.number}`),
    ).toEqual(['g1/bio/1', 'g1/bio/2', 'g1/cien/1', 'g1/cien/2', 'g5/arte/1', 'g5/arte/2']);
  });

  it('sin periodos o sin asignaciones no hay celdas ni docentes', () => {
    expect(first(buildCompliance([], [assignment('a', ['g1', 1], 'mat')], [])).items).toEqual([]);
    expect(buildCompliance(periods, [], [])).toEqual([]);
  });
});
