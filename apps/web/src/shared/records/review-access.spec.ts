import {
  canReviewGrade,
  consultNotice,
  coordinatorOfGrade,
  gradesWithoutCoordinator,
  joinNames,
  myGrades,
  reviewerHint,
  type CatalogGradeScope,
} from './review-access';

const ELENA = { id: 'c-1', fullName: 'Elena Ravassa' };
const MARCELA = { id: 'c-2', fullName: 'Marcela Rojas' };
const grades: CatalogGradeScope[] = [
  { id: 'g-1', name: 'Red', coordinator: ELENA },
  { id: 'g-2', name: 'Kinder', coordinator: MARCELA },
  { id: 'g-3', name: 'First Grade', coordinator: null },
  { id: 'g-4', name: 'Antiguo', active: false, coordinator: null },
];
const elena = { id: 'c-1', role: 'coordinador' } as const;
const admin = { id: 'a-1', role: 'administrador' } as const;
const teacher = { id: 't-1', role: 'docente' } as const;

describe('canReviewGrade', () => {
  it('solo la coordinadora del grado revisa', () => {
    expect(canReviewGrade(elena, ELENA)).toBe(true);
    expect(canReviewGrade(elena, MARCELA)).toBe(false);
    expect(canReviewGrade(admin, ELENA)).toBe(false);
    expect(canReviewGrade(teacher, ELENA)).toBe(false);
    expect(canReviewGrade(null, ELENA)).toBe(false);
  });

  it('un grado sin coordinadora no lo revisa nadie', () => {
    expect(canReviewGrade(elena, null)).toBe(false);
    expect(canReviewGrade(admin, null)).toBe(false);
  });
});

describe('catálogo de grados', () => {
  it('busca la coordinadora de un grado', () => {
    expect(coordinatorOfGrade(grades, 'g-2')).toEqual(MARCELA);
    expect(coordinatorOfGrade(grades, 'g-3')).toBeNull();
    expect(coordinatorOfGrade(grades, 'otro')).toBeNull();
  });

  it('lista los grados de la coordinadora en sesión y ninguno para otros roles', () => {
    expect(myGrades(elena, grades).map((grade) => grade.id)).toEqual(['g-1']);
    expect(myGrades(admin, grades)).toEqual([]);
    expect(myGrades(null, grades)).toEqual([]);
  });

  it('lista los grados activos sin coordinadora', () => {
    expect(gradesWithoutCoordinator(grades).map((grade) => grade.name)).toEqual(['First Grade']);
  });
});

describe('textos', () => {
  it('nombra quién revisa', () => {
    expect(reviewerHint(ELENA)).toBe('Revisa: Elena Ravassa');
    expect(reviewerHint(null)).toBe('Sin coordinadora');
  });

  it('une nombres en español', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['Kinder'])).toBe('Kinder');
    expect(joinNames(['Kinder', 'Transition'])).toBe('Kinder y Transition');
    expect(joinNames(['Red', 'Blue', 'Green'])).toBe('Red, Blue y Green');
  });

  it('explica el solo consulta de administración y de otra coordinadora', () => {
    expect(consultNotice(admin, MARCELA, 'Transition', 'esta planeación')).toBe(
      'Administración consulta los registros; la revisión es de Marcela Rojas, coordinadora de Transition.',
    );
    expect(consultNotice(elena, MARCELA, 'Red', 'esta planeación')).toBe(
      'Red lo acompaña Marcela Rojas: puedes leer esta planeación, pero la revisión es suya.',
    );
  });

  it('explica el solo consulta de un grado sin coordinadora', () => {
    expect(consultNotice(admin, null, 'First Grade', 'este diario')).toContain(
      'First Grade no tiene coordinadora',
    );
    expect(consultNotice(elena, null, 'First Grade', 'este diario')).toBe(
      'First Grade no tiene coordinadora: puedes leer este diario, pero por ahora nadie la revisa.',
    );
  });
});
