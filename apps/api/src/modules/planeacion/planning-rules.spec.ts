import {
  allowedFrom,
  approveLessonPlanSchema,
  canTransition,
  createLessonPlanResourceSchema,
  createLessonPlanSchema,
  crossCuttingProjectFor,
  diffFields,
  fromStoredChanges,
  LESSON_PLAN_ADJUSTABLE_FIELDS,
  levelAllowsCuriocity,
  RecordActor,
  RecordOperation,
  RecordStatus,
  returnLessonPlanSchema,
  toStoredChanges,
  updateLessonPlanSchema,
  validateLessonPlanForSubmit,
  voidLessonPlanSchema,
} from '@gns/shared';

const UUID = '3f2b8c1e-5d4a-4b7e-9a1c-2d6e8f0a1b3c';
const { Draft, Submitted, ChangesRequested, Reviewed, Voided } = RecordStatus;
const STATUSES = Object.values(RecordStatus);

describe('máquina de estados de registros', () => {
  const statesFor = (operation: RecordOperation, actor: RecordActor) =>
    STATUSES.filter((status) => canTransition(operation, actor, status));

  it('el dueño edita y envía solo desde borrador y observaciones', () => {
    for (const operation of [RecordOperation.Edit, RecordOperation.Submit]) {
      expect(statesFor(operation, RecordActor.Owner)).toEqual([Draft, ChangesRequested]);
      expect(statesFor(operation, RecordActor.Reviewer)).toEqual([]);
    }
    expect(allowedFrom(RecordOperation.Submit, RecordActor.Owner)?.to).toBe(Submitted);
    expect(allowedFrom(RecordOperation.Edit, RecordActor.Owner)?.to).toBeNull();
  });

  it('coordinación aprueba y devuelve solo desde enviada', () => {
    expect(statesFor(RecordOperation.Approve, RecordActor.Reviewer)).toEqual([Submitted]);
    expect(statesFor(RecordOperation.Return, RecordActor.Reviewer)).toEqual([Submitted]);
    expect(allowedFrom(RecordOperation.Approve, RecordActor.Reviewer)?.to).toBe(Reviewed);
    expect(allowedFrom(RecordOperation.Return, RecordActor.Reviewer)?.to).toBe(ChangesRequested);
    expect(allowedFrom(RecordOperation.Approve, RecordActor.Owner)).toBeNull();
    expect(allowedFrom(RecordOperation.Return, RecordActor.Owner)).toBeNull();
  });

  it('el dueño anula antes de la revisión y coordinación desde cualquier estado salvo anulado', () => {
    expect(statesFor(RecordOperation.Void, RecordActor.Owner)).toEqual([
      Draft,
      Submitted,
      ChangesRequested,
    ]);
    expect(statesFor(RecordOperation.Void, RecordActor.Reviewer)).toEqual([
      Draft,
      Submitted,
      ChangesRequested,
      Reviewed,
    ]);
    expect(allowedFrom(RecordOperation.Void, RecordActor.Reviewer)?.to).toBe(Voided);
  });

  it('crear es del dueño y deja borrador; anulado es terminal', () => {
    expect(allowedFrom(RecordOperation.Create, RecordActor.Owner)).toEqual({
      from: [],
      to: Draft,
    });
    expect(allowedFrom(RecordOperation.Create, RecordActor.Reviewer)).toBeNull();
    for (const operation of Object.values(RecordOperation)) {
      for (const actor of Object.values(RecordActor)) {
        expect(canTransition(operation, actor, Voided)).toBe(false);
      }
    }
  });

  it('revisada solo admite anular por coordinación', () => {
    for (const operation of Object.values(RecordOperation)) {
      for (const actor of Object.values(RecordActor)) {
        const allowed = canTransition(operation, actor, Reviewed);
        expect(allowed).toBe(operation === RecordOperation.Void && actor === RecordActor.Reviewer);
      }
    }
  });
});

describe('proyecto transversal y CurioCity por nivel', () => {
  it.each([
    ['Preescolar bajo', [null, null, null]],
    ['Preescolar alto (KTF)', ['Ciudad+', 'STEAM+H', 'Emprendimiento Inicial']],
    ['Primaria', ['Ciudad+', 'STEAM+H', 'Emprendimiento Escolar']],
    ['Bachillerato', ['STEAM+H', 'Ciudad+', 'Emprendimiento · Dragon Fire']],
  ])('%s', (level, projects) => {
    expect([1, 2, 3].map((period) => crossCuttingProjectFor(level, period))).toEqual(projects);
  });

  it.each(['Nivel inventado', 'toString', ''])(
    'un nivel desconocido («%s») queda sin proyecto',
    (level) => {
      expect(crossCuttingProjectFor(level, 1)).toBeNull();
      expect(levelAllowsCuriocity(level)).toBe(false);
    },
  );

  it('un periodo fuera de 1 a 3 no tiene proyecto', () => {
    expect(crossCuttingProjectFor('Primaria', 4)).toBeNull();
    expect(crossCuttingProjectFor('Primaria', 0)).toBeNull();
  });

  it('solo bachillerato admite CurioCity', () => {
    expect(
      ['Preescolar bajo', 'Preescolar alto (KTF)', 'Primaria', 'Bachillerato'].filter(
        levelAllowsCuriocity,
      ),
    ).toEqual(['Bachillerato']);
  });
});

describe('validateLessonPlanForSubmit', () => {
  it('no devuelve errores con desempeño y momento de desarrollo', () => {
    expect(
      validateLessonPlanForSubmit({ expectedPerformance: 'Explica', developmentMoment: 'Trabaja' }),
    ).toEqual([]);
  });

  it('lista cada campo vacío, nulo o solo con espacios', () => {
    expect(
      validateLessonPlanForSubmit({ expectedPerformance: '  ', developmentMoment: null }).map(
        (error) => error.field,
      ),
    ).toEqual(['expectedPerformance', 'developmentMoment']);
    expect(
      validateLessonPlanForSubmit({ expectedPerformance: 'ok', developmentMoment: '' }),
    ).toEqual([{ field: 'developmentMoment', reason: 'es obligatorio para enviar' }]);
  });
});

describe('diffFields', () => {
  const map = LESSON_PLAN_ADJUSTABLE_FIELDS;

  it('devuelve solo los campos que cambiaron, con la columna y los valores', () => {
    expect(
      diffFields(
        { topic: 'A', closingMoment: null, resources: 'x' },
        { topic: 'B', closingMoment: 'Cierre', resources: 'x' },
        map,
      ),
    ).toEqual([
      { field: 'tema', before: 'A', after: 'B' },
      { field: 'momento_cierre', before: null, after: 'Cierre' },
    ]);
  });

  it('normaliza fechas a AAAA-MM-DD y trata vacío, nulo y ausente como iguales', () => {
    expect(
      diffFields(
        { dateFrom: new Date('2026-09-21T00:00:00Z'), topic: '', resources: undefined },
        { dateFrom: '2026-09-21', topic: null, resources: null },
        map,
      ),
    ).toEqual([]);
    expect(
      diffFields({ dateTo: new Date('2026-09-25T00:00:00Z') }, { dateTo: '2026-09-26' }, map),
    ).toEqual([{ field: 'fecha_hasta', before: '2026-09-25', after: '2026-09-26' }]);
  });

  it('ignora las claves fuera del mapa y se guarda y lee sin pérdida', () => {
    const changes = diffFields({ topic: 'A', other: 1 }, { topic: 'B', other: 2 }, map);

    expect(changes).toHaveLength(1);
    expect(toStoredChanges(changes)).toEqual({ tema: { antes: 'A', despues: 'B' } });
    expect(fromStoredChanges(toStoredChanges(changes))).toEqual(changes);
  });

  it.each([null, undefined, [], 'texto'])(
    'las filas sin valores guardados (%j) dan lista vacía',
    (stored) => {
      expect(fromStoredChanges(stored)).toEqual([]);
    },
  );
});

describe('esquemas de planeación', () => {
  const base = { gradeId: UUID, areaId: UUID, periodId: UUID };

  it('crear recorta textos, guarda vacío como null y rechaza campos desconocidos', () => {
    expect(createLessonPlanSchema.parse({ ...base, topic: '  Tema  ', resources: '   ' })).toEqual({
      ...base,
      topic: 'Tema',
      resources: null,
    });
    for (const extra of [
      { crossCuttingProject: 'Ciudad+' },
      { studentName: 'Ana' },
      { status: 'revisada' },
    ]) {
      expect(createLessonPlanSchema.safeParse({ ...base, ...extra }).success).toBe(false);
    }
  });

  it('valida etapa, fechas y topes de longitud', () => {
    const parse = (extra: object) =>
      createLessonPlanSchema.safeParse({ ...base, ...extra }).success;

    expect(parse({ curiocityStage: 'Otra' })).toBe(false);
    expect(parse({ curiocityStage: 'Creo' })).toBe(true);
    expect(parse({ dateFrom: '21/09/2026' })).toBe(false);
    expect(parse({ topic: 'x'.repeat(161) })).toBe(false);
    expect(parse({ closingMoment: 'x'.repeat(4001) })).toBe(false);
  });

  it('editar exige algún campo, no admite grado ni área y null vacía', () => {
    expect(updateLessonPlanSchema.safeParse({}).success).toBe(false);
    expect(updateLessonPlanSchema.safeParse({ gradeId: UUID }).success).toBe(false);
    expect(updateLessonPlanSchema.parse({ topic: null, periodId: UUID })).toEqual({
      topic: null,
      periodId: UUID,
    });
  });

  it('devolver exige comentario; aprobar lo admite vacío; los ajustes necesitan un campo', () => {
    expect(returnLessonPlanSchema.safeParse({}).success).toBe(false);
    expect(returnLessonPlanSchema.safeParse({ comment: '  ' }).success).toBe(false);
    expect(returnLessonPlanSchema.safeParse({ comment: 'x'.repeat(2001) }).success).toBe(false);
    expect(approveLessonPlanSchema.parse({})).toEqual({});
    expect(approveLessonPlanSchema.parse({ comment: '  ' })).toEqual({ comment: null });
    expect(approveLessonPlanSchema.safeParse({ changes: {} }).success).toBe(false);
    expect(approveLessonPlanSchema.safeParse({ changes: { periodId: UUID } }).success).toBe(false);
    expect(
      returnLessonPlanSchema.parse({ comment: 'Ajustar', changes: { topic: 'Nuevo' } }),
    ).toEqual({ comment: 'Ajustar', changes: { topic: 'Nuevo' } });
  });

  it('anular exige un motivo de 3 a 300 caracteres', () => {
    expect(voidLessonPlanSchema.parse({ reason: '  Duplicada ' })).toEqual({ reason: 'Duplicada' });
    expect(voidLessonPlanSchema.safeParse({ reason: 'ab' }).success).toBe(false);
    expect(voidLessonPlanSchema.safeParse({ reason: 'x'.repeat(301) }).success).toBe(false);
    expect(voidLessonPlanSchema.safeParse({}).success).toBe(false);
  });
});

describe('esquema de recurso digital', () => {
  const base = { tool: 'Canva', name: 'Presentación', url: 'https://canva.com/d/1' };
  const parse = (extra: object) => createLessonPlanResourceSchema.safeParse({ ...base, ...extra });

  it('acepta http y https, y el momento 1 a 4 o ninguno (general)', () => {
    expect(createLessonPlanResourceSchema.parse(base).moment).toBeNull();
    expect(parse({ url: 'http://a.co/x', moment: 4 }).success).toBe(true);
    expect(createLessonPlanResourceSchema.parse({ ...base, moment: null }).moment).toBeNull();
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,hola',
    'ftp://a.co/x',
    '/relativa',
    'canva.com',
    '',
  ])('rechaza la URL «%s»', (url) => {
    expect(parse({ url }).success).toBe(false);
  });

  it.each([0, 5, 1.5, -1])('rechaza el momento %s', (moment) => {
    expect(parse({ moment }).success).toBe(false);
  });

  it('rechaza herramientas, nombres vacíos y campos desconocidos', () => {
    expect(parse({ tool: 'Genially' }).success).toBe(false);
    expect(parse({ name: ' ' }).success).toBe(false);
    expect(parse({ extra: 1 }).success).toBe(false);
  });
});
