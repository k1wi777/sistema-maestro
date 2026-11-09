import {
  ASSIGNABLE_ROLES,
  createAcademicPeriodSchema,
  createGradeSchema,
  createSchoolYearSchema,
  createTeacherAssignmentSchema,
  schoolYearSchema,
  teacherAssignmentListQuerySchema,
  updateAcademicPeriodSchema,
  updateAreaSchema,
  updateLevelSchema,
  UserRole,
} from '@gns/shared';

describe('schoolYearSchema', () => {
  it('acepta AAAA-AAAA con años consecutivos', () => {
    expect(schoolYearSchema.safeParse('2026-2027').success).toBe(true);
    expect(createSchoolYearSchema.parse({ code: ' 2027-2028 ' })).toEqual({ code: '2027-2028' });
  });

  it.each(['2026', '2026-2028', '2027-2026', '26-27', '2026/2027', ''])('rechaza «%s»', (code) => {
    expect(schoolYearSchema.safeParse(code).success).toBe(false);
  });
});

describe('periodos académicos', () => {
  const base = { schoolYear: '2026-2027', number: 1 };

  it('acepta fechas ordenadas, iguales o ausentes', () => {
    expect(createAcademicPeriodSchema.safeParse(base).success).toBe(true);
    expect(
      createAcademicPeriodSchema.safeParse({
        ...base,
        startDate: '2026-08-01',
        endDate: '2026-08-01',
      }).success,
    ).toBe(true);
  });

  it('rechaza inicio posterior al fin y números fuera de 1..3', () => {
    const inverted = createAcademicPeriodSchema.safeParse({
      ...base,
      startDate: '2026-09-01',
      endDate: '2026-08-01',
    });
    expect(inverted.success).toBe(false);
    expect(createAcademicPeriodSchema.safeParse({ ...base, number: 4 }).success).toBe(false);
    expect(createAcademicPeriodSchema.safeParse({ ...base, number: 0 }).success).toBe(false);
  });

  it('el PATCH solo admite fechas y no puede estar vacío', () => {
    expect(updateAcademicPeriodSchema.safeParse({ startDate: '2026-08-01' }).success).toBe(true);
    expect(updateAcademicPeriodSchema.safeParse({ endDate: null }).success).toBe(true);
    expect(updateAcademicPeriodSchema.safeParse({}).success).toBe(false);
    expect(updateAcademicPeriodSchema.safeParse({ schoolYear: '2027-2028' }).success).toBe(false);
    expect(updateAcademicPeriodSchema.safeParse({ number: 2 }).success).toBe(false);
    expect(
      updateAcademicPeriodSchema.safeParse({ startDate: '2026-09-01', endDate: '2026-08-01' })
        .success,
    ).toBe(false);
  });
});

describe('catálogos', () => {
  it('el PATCH vacío se rechaza y no repone valores', () => {
    expect(updateLevelSchema.safeParse({}).success).toBe(false);
    expect(updateAreaSchema.safeParse({}).success).toBe(false);
    expect(updateLevelSchema.parse({ name: ' Primaria ' })).toEqual({ name: 'Primaria' });
  });

  it('valida longitud del nombre, orden y tipo', () => {
    const levelId = '5b1e2d9e-5f2e-4c7a-9a0e-0b6d6f1a2c11';
    expect(
      createGradeSchema.safeParse({ name: 'x'.repeat(41), levelId, sortOrder: 1 }).success,
    ).toBe(false);
    expect(createGradeSchema.safeParse({ name: 'Uno', levelId, sortOrder: 32768 }).success).toBe(
      false,
    );
    expect(createGradeSchema.safeParse({ name: 'Uno', levelId, sortOrder: 1 }).success).toBe(true);
    expect(updateAreaSchema.safeParse({ type: 'otro' }).success).toBe(false);
  });
});

describe('asignaciones docentes', () => {
  const ids = {
    teacherId: '5b1e2d9e-5f2e-4c7a-9a0e-0b6d6f1a2c11',
    gradeId: '5b1e2d9e-5f2e-4c7a-9a0e-0b6d6f1a2c12',
    areaId: '5b1e2d9e-5f2e-4c7a-9a0e-0b6d6f1a2c13',
  };

  it('el director de grupo es falso por omisión y el año es opcional', () => {
    const parsed = createTeacherAssignmentSchema.parse(ids);
    expect(parsed.isHomeroomTeacher).toBe(false);
    expect(parsed.schoolYear).toBeUndefined();
  });

  it('rechaza campos desconocidos y años mal formados', () => {
    expect(createTeacherAssignmentSchema.safeParse({ ...ids, status: 'activa' }).success).toBe(
      false,
    );
    expect(createTeacherAssignmentSchema.safeParse({ ...ids, schoolYear: '2026' }).success).toBe(
      false,
    );
  });

  it('el listado rechaza parámetros desconocidos y valida el estado', () => {
    expect(teacherAssignmentListQuerySchema.safeParse({ foo: '1' }).success).toBe(false);
    expect(teacherAssignmentListQuerySchema.safeParse({ status: 'otra' }).success).toBe(false);
    const parsed = teacherAssignmentListQuerySchema.parse({ status: 'retirada' });
    expect(parsed.filters).toEqual({ status: 'retirada' });
    expect(parsed.sort).toEqual({ field: 'createdAt', order: 'desc' });
  });

  it('solo docente y coordinador son asignables', () => {
    expect(ASSIGNABLE_ROLES).toEqual([UserRole.Teacher, UserRole.Coordinator]);
  });
});
