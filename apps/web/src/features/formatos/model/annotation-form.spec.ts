import {
  buildAnnotationChanges,
  buildCreateAnnotation,
  emptyAnnotationValues,
  mapAnnotationApiErrors,
  parseStudents,
  valuesFromAnnotation,
} from './annotation-form';
import { makeAnnotation } from './test-fixtures';

const CONTEXT = { groupId: '44444444-4444-4444-8444-444444444444', date: '2026-11-09' };
const AREA = '33333333-3333-4333-8333-333333333333';

const filled = () => ({
  ...emptyAnnotationValues(AREA),
  eventType: 'grupo' as const,
  students: 'Sofía, Matías',
  description: 'Trabajaron en equipo.',
});

describe('annotation form', () => {
  it('parses first names separated by comma or semicolon', () => {
    expect(parseStudents('Sofía, Matías; Ana')).toEqual(['Sofía', 'Matías', 'Ana']);
    expect(parseStudents('  ')).toEqual([]);
  });

  it('builds the creation body with the group and the date', () => {
    const built = buildCreateAnnotation(filled(), CONTEXT);
    expect(built).toMatchObject({
      ok: true,
      data: { ...CONTEXT, areaId: AREA, eventType: 'grupo', students: ['Sofía', 'Matías'] },
    });
  });

  it('asks for the subject, the type and the description', () => {
    const built = buildCreateAnnotation(emptyAnnotationValues(), CONTEXT);
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(Object.keys(built.errors).sort()).toEqual(['areaId', 'description', 'eventType']);
    }
  });

  it('requires actions for an aspect to improve and rejects full names of students', () => {
    const toImprove = buildCreateAnnotation({ ...filled(), eventType: 'mejorar' }, CONTEXT);
    expect(toImprove.ok).toBe(false);
    if (!toImprove.ok) {
      expect(toImprove.errors.actions).toMatch(/a mejorar/);
    }
    const names = buildCreateAnnotation({ ...filled(), students: 'Pedro 1023456789' }, CONTEXT);
    expect(names.ok).toBe(false);
    if (!names.ok) {
      expect(names.errors.students).toBeDefined();
      expect(JSON.stringify(names.errors)).not.toContain('1023456789');
    }
  });

  it('sends only what changed when editing and nothing when nothing changed', () => {
    const original = makeAnnotation();
    expect(buildAnnotationChanges(valuesFromAnnotation(original), original)).toEqual({
      ok: true,
      data: null,
    });
    const changed = buildAnnotationChanges(
      { ...valuesFromAnnotation(original), description: 'Nueva descripción' },
      original,
    );
    expect(changed).toEqual({ ok: true, data: { description: 'Nueva descripción' } });
  });

  it('checks the actions rule on the resulting annotation, not only on the patch', () => {
    const original = makeAnnotation({ eventType: 'grupo', actions: null });
    const built = buildAnnotationChanges(
      { ...valuesFromAnnotation(original), eventType: 'mejorar' },
      original,
    );
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.errors.actions).toBeDefined();
    }
  });

  it('maps the 400 errors of the API to the fields of the form', () => {
    const mapped = mapAnnotationApiErrors([
      { field: 'areaId', reason: 'no es una de tus asignaturas en ese grupo' },
      { field: 'date', reason: 'no puede ser posterior a hoy' },
    ]);
    expect(mapped.fields.areaId).toBe('No es una de tus asignaturas en ese grupo.');
    expect(mapped.other).toEqual(['No puede ser posterior a hoy.']);
  });
});
