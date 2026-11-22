import {
  buildAnnotationChanges,
  buildCreateAnnotation,
  emptyAnnotationValues,
  mapAnnotationApiErrors,
  valuesFromAnnotation,
} from './annotation-form';
import { makeAnnotation } from './test-fixtures';

const CONTEXT = { groupId: '44444444-4444-4444-8444-444444444444', date: '2026-11-09' };
const AREA = '33333333-3333-4333-8333-333333333333';

const filled = () => ({
  ...emptyAnnotationValues(AREA),
  description: 'Sofía y Matías trabajaron en equipo.',
});

describe('annotation form', () => {
  it('builds the creation body with the group and the date and nothing else', () => {
    const built = buildCreateAnnotation(filled(), CONTEXT);
    expect(built).toEqual({
      ok: true,
      data: { ...CONTEXT, areaId: AREA, description: 'Sofía y Matías trabajaron en equipo.' },
    });
  });

  it('asks for the class and the description', () => {
    const built = buildCreateAnnotation(emptyAnnotationValues(), CONTEXT);
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(Object.keys(built.errors).sort()).toEqual(['areaId', 'description']);
    }
  });

  it('rejects a description over the limit', () => {
    const built = buildCreateAnnotation({ ...filled(), description: 'x'.repeat(1501) }, CONTEXT);
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.errors.description).toBeDefined();
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

  it('maps the 400 errors of the API to the fields of the form', () => {
    const mapped = mapAnnotationApiErrors([
      { field: 'areaId', reason: 'no es una de tus asignaturas en ese grupo' },
      { field: 'date', reason: 'no puede ser posterior a hoy' },
    ]);
    expect(mapped.fields.areaId).toBe('No es una de tus asignaturas en ese grupo.');
    expect(mapped.other).toEqual(['No puede ser posterior a hoy.']);
  });
});
