import {
  allowedFromAny,
  approveFieldJournalSchema,
  createFieldJournalEntrySchema,
  createObserverNoteSchema,
  isStudentFirstName,
  journalEntryChangeField,
  journalStudentsSchema,
  observerNoteListQuerySchema,
  parseJournalEntryChangeField,
  RecordActor,
  RecordOperation,
  RecordStatus,
  studentFirstNameSchema,
  updateFieldJournalEntrySchema,
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
  const entry = { date: '2031-03-10', lesson: 'Matemáticas', eventType: 'grupo', description: 'x' };

  it('una entrada «a mejorar» exige acciones', () => {
    const result = createFieldJournalEntrySchema.safeParse({ ...entry, eventType: 'mejorar' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['actions']);
    expect(
      createFieldJournalEntrySchema.safeParse({
        ...entry,
        eventType: 'mejorar',
        actions: 'Practicar',
      }).success,
    ).toBe(true);
  });

  it('rechaza campos desconocidos y no admite entradas vacías', () => {
    expect(createFieldJournalEntrySchema.safeParse({ ...entry, phone: '3000000000' }).success).toBe(
      false,
    );
    expect(updateFieldJournalEntrySchema.safeParse({}).success).toBe(false);
  });

  it('los ajustes exigen entradas únicas y al menos un campo por entrada', () => {
    const ok = { entries: [{ id: UUID, description: 'nuevo' }] };
    expect(approveFieldJournalSchema.safeParse({ changes: ok }).success).toBe(true);
    expect(
      approveFieldJournalSchema.safeParse({ changes: { entries: [{ id: UUID }] } }).success,
    ).toBe(false);
    expect(
      approveFieldJournalSchema.safeParse({
        changes: { entries: [ok.entries[0], ok.entries[0]] },
      }).success,
    ).toBe(false);
    expect(approveFieldJournalSchema.safeParse({ changes: { entries: [] } }).success).toBe(false);
  });

  it('la clave de ajuste de una entrada hace ida y vuelta', () => {
    const field = journalEntryChangeField(UUID, 'descripcion');
    expect(field).toBe(`entradas.${UUID}.descripcion`);
    expect(parseJournalEntryChangeField(field)).toEqual({ entryId: UUID, column: 'descripcion' });
    expect(parseJournalEntryChangeField('fecha_desde')).toBeNull();
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
