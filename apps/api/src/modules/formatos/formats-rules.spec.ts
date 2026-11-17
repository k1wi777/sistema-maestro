import {
  allowedFromAny,
  approveJournalSchema,
  createAnnotationSchema,
  createObserverNoteSchema,
  isStudentFirstName,
  journalStudentsSchema,
  observerNoteListQuerySchema,
  RecordActor,
  RecordOperation,
  RecordStatus,
  studentFirstNameSchema,
  returnJournalSchema,
  updateAnnotationSchema,
  updateObserverNoteSchema,
  voidLessonPlanSchema,
  voidRecordSchema,
} from '@gns/shared';

const UUID = '3f2b8c1e-5d4a-4b7e-9a1c-2d6e8f0a1b3c';

describe('nombre de pila de estudiantes', () => {
  it.each(['Sofía', 'Íñigo', 'Zoë', 'Ana-María', "D'Angelo", 'María José', 'Juan David'])(
    'acepta %s',
    (name) => {
      expect(isStudentFirstName(name)).toBe(true);
    },
  );

  it.each([
    'María del Carmen',
    'Juan P',
    '1023456789',
    'Ana3',
    'ana@x.co',
    'Cl.',
    'J',
    'a'.repeat(21),
    'Abcdefghijklmnopqrst Abcdefghij',
    'Ana 😀',
    '',
    '   ',
  ])('rechaza %j', (name) => {
    expect(isStudentFirstName(name)).toBe(false);
  });

  it('normaliza espacios repetidos y NFC', () => {
    expect(studentFirstNameSchema.parse('  Juan   David ')).toBe('Juan David');
    expect(studentFirstNameSchema.parse('Zoë')).toBe('Zoë');
  });

  it('el motivo del rechazo no repite el valor', () => {
    const result = studentFirstNameSchema.safeParse('Pedro 1023456789');
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).not.toContain('1023456789');
    expect(JSON.stringify(result.error?.issues)).not.toContain('Pedro');
  });
});

describe('lista de estudiantes de una entrada', () => {
  it('acepta hasta 12 distintos', () => {
    const names = Array.from({ length: 12 }, (_, i) => `Ab${'cdefghijklmn'[i]}`);
    expect(journalStudentsSchema.safeParse(names).success).toBe(true);
    expect(journalStudentsSchema.safeParse([...names, 'Zzz']).success).toBe(false);
  });

  it('rechaza repetidos sin distinguir mayúsculas', () => {
    expect(journalStudentsSchema.safeParse(['Sofía', 'sofía']).success).toBe(false);
  });

  it('rechaza una lista unida de más de 160 caracteres', () => {
    const names = Array.from({ length: 10 }, (_, i) => `${'A'.repeat(15)}${'bcdefghijk'[i]}`);
    expect(journalStudentsSchema.safeParse(names).success).toBe(false);
  });
});

describe('esquemas del diario', () => {
  const annotation = {
    groupId: UUID,
    date: '2031-03-10',
    areaId: UUID,
    eventType: 'grupo',
    description: 'x',
  };

  it('una anotación «a mejorar» exige acciones', () => {
    const result = createAnnotationSchema.safeParse({ ...annotation, eventType: 'mejorar' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['actions']);
    expect(
      createAnnotationSchema.safeParse({
        ...annotation,
        eventType: 'mejorar',
        actions: 'Practicar',
      }).success,
    ).toBe(true);
  });

  it('rechaza campos desconocidos, fechas inválidas y no admite ediciones vacías', () => {
    expect(createAnnotationSchema.safeParse({ ...annotation, phone: '3000000000' }).success).toBe(
      false,
    );
    expect(createAnnotationSchema.safeParse({ ...annotation, date: '10/03/2031' }).success).toBe(
      false,
    );
    expect(
      createAnnotationSchema.safeParse({ ...annotation, students: ['Sofía 123'] }).success,
    ).toBe(false);
    expect(updateAnnotationSchema.safeParse({}).success).toBe(false);
    expect(updateAnnotationSchema.safeParse({ description: 'nuevo' }).success).toBe(true);
  });

  it('aprobar admite solo el comentario y devolver exige alguna observación', () => {
    expect(approveJournalSchema.safeParse({}).success).toBe(true);
    expect(approveJournalSchema.parse({ comment: '  ' }).comment).toBeNull();
    expect(approveJournalSchema.safeParse({ changes: {} }).success).toBe(false);
    expect(returnJournalSchema.safeParse({}).success).toBe(false);
    expect(returnJournalSchema.safeParse({ comment: 'Revisa la fecha' }).success).toBe(true);
    const observation = { annotationId: UUID, text: 'Amplía la descripción' };
    expect(returnJournalSchema.safeParse({ observations: [observation] }).success).toBe(true);
  });

  it('devolver no repite anotaciones ni admite observaciones vacías', () => {
    const observation = { annotationId: UUID, text: 'Amplía' };
    expect(
      returnJournalSchema.safeParse({ observations: [observation, observation] }).success,
    ).toBe(false);
    expect(
      returnJournalSchema.safeParse({ observations: [{ annotationId: UUID, text: ' ' }] }).success,
    ).toBe(false);
  });
});

describe('esquemas del observador', () => {
  const note = {
    gradeId: UUID,
    studentFirstName: 'Sofía',
    date: '2031-03-10',
    type: 'tipo_ii',
    description: 'Situación en el recreo',
  };

  it('guarda familia informada en falso por defecto y rechaza datos personales', () => {
    expect(createObserverNoteSchema.parse(note).familyInformed).toBe(false);
    expect(createObserverNoteSchema.safeParse({ ...note, documentId: '1' }).success).toBe(false);
    expect(
      createObserverNoteSchema.safeParse({ ...note, studentFirstName: 'Sofía Pérez 7' }).success,
    ).toBe(false);
  });

  it('el grado no se edita', () => {
    expect(updateObserverNoteSchema.safeParse({ gradeId: UUID }).success).toBe(false);
    expect(updateObserverNoteSchema.safeParse({ type: 'tipo_iii' }).success).toBe(true);
  });

  it('el listado ordena por prioridad por defecto y rechaza parámetros desconocidos', () => {
    expect(observerNoteListQuerySchema.parse({}).sort).toEqual({
      field: 'priority',
      order: 'desc',
    });
    expect(observerNoteListQuerySchema.safeParse({ studentFirstName: 'Sofía' }).success).toBe(
      false,
    );
  });
});

describe('reglas comunes', () => {
  it('allowedFromAny une los estados de origen de varios papeles', () => {
    const owner = allowedFromAny(RecordOperation.Void, [RecordActor.Owner]);
    const both = allowedFromAny(RecordOperation.Void, [RecordActor.Owner, RecordActor.Reviewer]);
    expect(owner).not.toContain(RecordStatus.Reviewed);
    expect(both).toContain(RecordStatus.Reviewed);
    expect(both).not.toContain(RecordStatus.Voided);
    expect(new Set(both).size).toBe(both.length);
    expect(allowedFromAny(RecordOperation.Approve, [RecordActor.Owner])).toEqual([]);
  });

  it('el esquema de anular lo comparten planeación y formatos', () => {
    expect(voidLessonPlanSchema).toBe(voidRecordSchema);
    expect(voidRecordSchema.safeParse({ reason: 'ab' }).success).toBe(false);
    expect(voidRecordSchema.safeParse({ reason: 'Error de grado' }).success).toBe(true);
  });
});
