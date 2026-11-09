import {
  createSharedActivitySchema,
  foldSearchText,
  lessonPlanComplianceQuerySchema,
  lessonPlanListQuerySchema,
  SEARCH_FOLD_FROM,
  SEARCH_FOLD_TO,
  searchWords,
  sharedActivityListQuerySchema,
  updateSharedActivitySchema,
} from '@gns/shared';

const UUID = '3f2b8c1e-5d4a-4b7e-9a1c-2d6e8f0a1b3c';
const valid = { title: 'Canción del agua', steps: '1. Cantar.' };

describe('plegado de texto de la búsqueda', () => {
  it('quita tildes, diéresis, ñ y ç sin cambiar mayúsculas', () => {
    expect(foldSearchText('Canción del río en el día')).toBe('Cancion del rio en el dia');
    expect(foldSearchText('PIÑATA ÇÜ')).toBe('PINATA CU');
  });

  it('el mapa de translate pliega cada carácter igual que foldSearchText', () => {
    expect(SEARCH_FOLD_FROM).toHaveLength(SEARCH_FOLD_TO.length);
    [...SEARCH_FOLD_FROM].forEach((char, index) => {
      expect(foldSearchText(char)).toBe(SEARCH_FOLD_TO[index]);
    });
  });

  it('divide en palabras, sin repetir y hasta cinco', () => {
    expect(searchWords('  rio   dia rio ')).toEqual(['rio', 'dia']);
    expect(searchWords('a b c d e f g')).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(searchWords('   ')).toEqual([]);
  });
});

describe('esquemas de actividad compartida', () => {
  it('acepta lo mínimo y recorta; el texto vacío pasa a null', () => {
    const parsed = createSharedActivitySchema.parse({
      title: '  Canción  ',
      steps: ' Cantar ',
      objective: '   ',
    });
    expect(parsed).toMatchObject({ title: 'Canción', steps: 'Cantar', objective: null });
  });

  it('rechaza campos desconocidos, incluidos datos de estudiantes', () => {
    expect(createSharedActivitySchema.safeParse({ ...valid, studentName: 'Ana' }).success).toBe(
      false,
    );
    expect(updateSharedActivitySchema.safeParse({ authorId: UUID }).success).toBe(false);
  });

  it('exige título y pasos y respeta los límites', () => {
    expect(createSharedActivitySchema.safeParse({ steps: 'x' }).success).toBe(false);
    expect(createSharedActivitySchema.safeParse({ title: 'x' }).success).toBe(false);
    expect(createSharedActivitySchema.safeParse({ ...valid, title: 'x'.repeat(161) }).success).toBe(
      false,
    );
    expect(createSharedActivitySchema.safeParse({ ...valid, durationMinutes: 0 }).success).toBe(
      false,
    );
    expect(createSharedActivitySchema.safeParse({ ...valid, durationMinutes: 481 }).success).toBe(
      false,
    );
    expect(createSharedActivitySchema.safeParse({ ...valid, durationMinutes: 480 }).success).toBe(
      true,
    );
    expect(createSharedActivitySchema.safeParse({ ...valid, levelId: 'no-uuid' }).success).toBe(
      false,
    );
  });

  it('solo admite enlaces http o https', () => {
    for (const link of ['javascript:alert(1)', 'data:text/html,x', 'ftp://a.co/x', '/relativa']) {
      expect(createSharedActivitySchema.safeParse({ ...valid, link }).success).toBe(false);
    }
    expect(createSharedActivitySchema.safeParse({ ...valid, link: 'https://a.co/x' }).success).toBe(
      true,
    );
  });

  it('la edición exige al menos un campo y admite null para vaciar', () => {
    expect(updateSharedActivitySchema.safeParse({}).success).toBe(false);
    expect(updateSharedActivitySchema.parse({ link: null, levelId: null })).toEqual({
      link: null,
      levelId: null,
    });
  });
});

describe('query de listados nuevos', () => {
  it('el repositorio acota q, acepta favorites solo con true y rechaza desconocidos', () => {
    expect(sharedActivityListQuerySchema.parse({ q: ' río ', favorites: 'true' }).filters).toEqual({
      q: 'río',
      favorites: true,
    });
    expect(sharedActivityListQuerySchema.safeParse({ q: 'a' }).success).toBe(false);
    expect(sharedActivityListQuerySchema.safeParse({ q: 'x'.repeat(101) }).success).toBe(false);
    expect(sharedActivityListQuerySchema.safeParse({ favorites: 'false' }).success).toBe(false);
    expect(sharedActivityListQuerySchema.safeParse({ favoriteOf: UUID }).success).toBe(false);
    expect(sharedActivityListQuerySchema.parse({}).sort).toEqual({
      field: 'createdAt',
      order: 'desc',
    });
  });

  it('la bandeja admite grado, área y docente y ordenar por envío', () => {
    const parsed = lessonPlanListQuerySchema.parse({
      gradeId: UUID,
      areaId: UUID,
      teacherId: UUID,
      sortBy: 'submittedAt',
    });
    expect(parsed.filters).toEqual({ gradeId: UUID, areaId: UUID, teacherId: UUID });
    expect(parsed.sort.field).toBe('submittedAt');
    expect(lessonPlanListQuerySchema.safeParse({ gradeId: 'x' }).success).toBe(false);
  });

  it('el cumplimiento admite periodId y teacherId y nada más', () => {
    expect(lessonPlanComplianceQuerySchema.parse({ periodId: UUID })).toEqual({ periodId: UUID });
    expect(lessonPlanComplianceQuerySchema.safeParse({ page: '1' }).success).toBe(false);
    expect(lessonPlanComplianceQuerySchema.safeParse({ teacherId: 'x' }).success).toBe(false);
  });
});
