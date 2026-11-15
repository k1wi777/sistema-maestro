import {
  buildCreateNote,
  buildNoteChanges,
  emptyNoteValues,
  mapNoteApiErrors,
  valuesFromNote,
  type NoteFormValues,
} from './observer-note-form';
import { makeNote } from './test-fixtures';

const GRADE_ID = '33333333-3333-4333-8333-333333333333';

function filled(overrides: Partial<NoteFormValues> = {}): NoteFormValues {
  return {
    ...emptyNoteValues('2026-11-05'),
    gradeId: GRADE_ID,
    studentFirstName: ' Tomás ',
    type: 'tipo_ii',
    description: 'Empujó a un compañero en la fila.',
    ...overrides,
  };
}

describe('observer note form', () => {
  it('builds the body of a new note with normalized name and empty optionals as null', () => {
    expect(buildCreateNote(filled())).toEqual({
      ok: true,
      data: {
        gradeId: GRADE_ID,
        studentFirstName: 'Tomás',
        date: '2026-11-05',
        type: 'tipo_ii',
        description: 'Empujó a un compañero en la fila.',
        studentVersion: null,
        actions: null,
        familyInformed: false,
        followUp: null,
      },
    });
  });

  it('requires the grade, the type and the description', () => {
    const result = buildCreateNote(filled({ gradeId: '', type: '', description: '  ' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.gradeId).toBe('Elige el grado.');
      expect(result.errors.type).toBe('Elige el tipo de anotación.');
      expect(result.errors.description).toBe('Es obligatorio.');
    }
  });

  it('rejects a name that is not a first name without echoing it', () => {
    for (const studentFirstName of ['Tomás Pérez Gómez', 'Tomás2', 'tomas@mail.com', '']) {
      const result = buildCreateNote(filled({ studentFirstName }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const message = result.errors.studentFirstName ?? '';
        expect(message).not.toBe('');
        expect(message).not.toContain('Gómez');
        expect(message).not.toContain('mail');
      }
    }
  });

  it('sends only the fields that changed when editing', () => {
    const note = makeNote();
    const values = {
      ...valuesFromNote(note),
      familyInformed: true,
      followUp: 'Se habló con la familia.',
    };
    expect(buildNoteChanges(values, note)).toEqual({
      ok: true,
      data: { familyInformed: true, followUp: 'Se habló con la familia.' },
    });
  });

  it('does not call the API when nothing changed', () => {
    const note = makeNote();
    expect(buildNoteChanges(valuesFromNote(note), note)).toEqual({ ok: true, data: null });
  });

  it('empties an optional text with null and never changes the grade', () => {
    const note = makeNote({ actions: 'Diálogo.' });
    const values = { ...valuesFromNote(note), actions: ' ', gradeId: 'otro' };
    expect(buildNoteChanges(values, note)).toEqual({ ok: true, data: { actions: null } });
  });

  it('rejects an invalid first name on edit without echoing it', () => {
    const note = makeNote();
    const values = { ...valuesFromNote(note), studentFirstName: 'Tomás 12' };
    const result = buildNoteChanges(values, note);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.studentFirstName).not.toContain('12');
    }
  });

  it('maps API errors to the form fields and keeps the rest apart', () => {
    const mapped = mapNoteApiErrors([
      { field: 'studentFirstName', reason: 'debe ser solo el nombre de pila' },
      { field: 'campo', reason: 'no permitido' },
    ]);
    expect(mapped.fields.studentFirstName).toBe('Debe ser solo el nombre de pila.');
    expect(mapped.other).toEqual(['No permitido.']);
  });
});
