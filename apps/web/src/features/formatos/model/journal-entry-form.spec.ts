import {
  buildCreateEntry,
  buildEntryChanges,
  emptyEntryValues,
  mapEntryApiErrors,
  parseStudents,
  valuesFromEntry,
  type EntryFormValues,
} from './journal-entry-form';
import { makeEntry } from './test-fixtures';

function filled(overrides: Partial<EntryFormValues> = {}): EntryFormValues {
  return {
    ...emptyEntryValues('2026-11-09'),
    lesson: 'Pre-ciencias · imanes',
    eventType: 'grupo',
    description: 'El grupo exploró los imanes.',
    ...overrides,
  };
}

describe('journal entry form', () => {
  it('splits the students by comma or semicolon', () => {
    expect(parseStudents('Sofía, Matías;  Lucía')).toEqual(['Sofía', 'Matías', 'Lucía']);
    expect(parseStudents('   ')).toEqual([]);
  });

  it('builds the body of a new entry with the optional texts emptied to null', () => {
    const result = buildCreateEntry(filled({ students: 'Sofía, Matías' }));
    expect(result).toEqual({
      ok: true,
      data: {
        date: '2026-11-09',
        lesson: 'Pre-ciencias · imanes',
        eventType: 'grupo',
        students: ['Sofía', 'Matías'],
        description: 'El grupo exploró los imanes.',
        actions: null,
        reflection: null,
      },
    });
  });

  it('requires the type of event and the required texts', () => {
    const result = buildCreateEntry(filled({ eventType: '', lesson: '', description: '' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.eventType).toBe('Elige el tipo de evento.');
      expect(result.errors.lesson).toBe('Es obligatorio.');
      expect(result.errors.description).toBe('Es obligatorio.');
    }
  });

  it('requires actions when the event is an aspect to improve', () => {
    const result = buildCreateEntry(filled({ eventType: 'mejorar', actions: '  ' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.actions).toContain('a mejorar');
    }
    expect(buildCreateEntry(filled({ eventType: 'mejorar', actions: 'Diálogo.' })).ok).toBe(true);
  });

  it('rejects a student that is not a first name without echoing the value', () => {
    for (const students of ['Sofía Gómez Pérez', 'Sofía1', 'sofia@mail.com', 'Sofía, sofía']) {
      const result = buildCreateEntry(filled({ students }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const message = result.errors.students ?? '';
        expect(message).not.toBe('');
        expect(message).not.toContain('Gómez');
        expect(message).not.toContain('mail');
      }
    }
  });

  it('rejects more than twelve students', () => {
    const many = 'Ana Beto Carla Diego Elena Fabio Gala Hugo Iris Juan Kira Luna Mara'.split(' ');
    const result = buildCreateEntry(filled({ students: many.join(', ') }));
    expect(result.ok).toBe(false);
  });

  it('sends only the fields that changed when editing', () => {
    const entry = makeEntry();
    const values = { ...valuesFromEntry(entry), description: 'Nueva descripción.' };
    expect(buildEntryChanges(values, entry)).toEqual({
      ok: true,
      data: { description: 'Nueva descripción.' },
    });
  });

  it('reports no changes when nothing differs', () => {
    const entry = makeEntry();
    expect(buildEntryChanges(valuesFromEntry(entry), entry)).toEqual({ ok: true, data: null });
  });

  it('empties an optional text with null and compares students as a list', () => {
    const entry = makeEntry({ actions: 'Diálogo.', students: ['Sofía', 'Matías'] });
    const values = { ...valuesFromEntry(entry), actions: '', students: 'Sofía; Matías' };
    expect(buildEntryChanges(values, entry)).toEqual({ ok: true, data: { actions: null } });
  });

  it('checks the improve rule on the resulting entry, not only on the patch', () => {
    const entry = makeEntry({ eventType: 'positivo', actions: null });
    const toImprove = { ...valuesFromEntry(entry), eventType: 'mejorar' as const };
    const result = buildEntryChanges(toImprove, entry);
    expect(result.ok).toBe(false);
    const withActions = { ...toImprove, actions: 'Compromiso.' };
    expect(buildEntryChanges(withActions, entry).ok).toBe(true);
    const cleared = makeEntry({ eventType: 'mejorar', actions: 'Diálogo.' });
    const emptied = { ...valuesFromEntry(cleared), actions: '' };
    expect(buildEntryChanges(emptied, cleared).ok).toBe(false);
  });

  it('maps API errors to the form fields and keeps the rest apart', () => {
    const mapped = mapEntryApiErrors([
      { field: 'students.1', reason: 'no puede repetir estudiantes' },
      { field: 'entries', reason: 'debe incluir al menos un registro' },
    ]);
    expect(mapped.fields.students).toBe('No puede repetir estudiantes.');
    expect(mapped.other).toEqual(['Debe incluir al menos un registro.']);
  });
});
