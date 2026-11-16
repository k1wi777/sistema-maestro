import { editorSteps, isEditorStepId, publishability } from './editor-steps';
import { activity, ID, moduleDetail } from './test-fixtures';

const file = { id: ID(900), name: 'v.mp4', contentType: 'video/mp4', size: 1000 };

describe('editorSteps', () => {
  it('son seis pasos y un módulo vacío tiene los cuatro de contenido vacíos y opcionales', () => {
    const steps = editorSteps(moduleDetail());
    expect(steps.map((step) => step.id)).toEqual([
      'datos',
      'video',
      'desafio',
      'presentacion',
      'actividades',
      'vista-previa',
    ]);
    expect(steps.map((step) => step.state)).toEqual([
      'done',
      'empty',
      'empty',
      'empty',
      'empty',
      'pending',
    ]);
    expect(steps[1]?.hint).toBe('Vacío · opcional');
  });

  it('marca con contenido el video por enlace o archivo, y la presentación por cualquiera de sus formas', () => {
    const byLink = editorSteps(moduleDetail({ videoUrl: 'https://youtu.be/abcdefghijk' }));
    expect(byLink[1]?.state).toBe('done');
    const byFile = editorSteps(moduleDetail({ videoFile: file }));
    expect(byFile[1]?.state).toBe('done');
    const slides = editorSteps(
      moduleDetail({ slides: [{ id: ID(1), sortOrder: 1, title: null, keyIdeas: 'a' }] }),
    );
    expect(slides[3]?.state).toBe('done');
    const link = editorSteps(moduleDetail({ presentationUrl: 'https://example.com/x' }));
    expect(link[3]?.state).toBe('done');
  });

  it('una actividad fuera del módulo no cuenta como contenido', () => {
    const steps = editorSteps(
      moduleDetail({ activities: [activity(1, { status: 'fuera_del_plan' })] }),
    );
    expect(steps[4]?.state).toBe('empty');
    const active = editorSteps(moduleDetail({ activities: [activity(1)] }));
    expect(active[4]?.state).toBe('done');
  });
});

describe('publishability', () => {
  it('sin ningún contenido no se puede publicar y explica qué falta', () => {
    const result = publishability(moduleDetail());
    expect(result.publishable).toBe(false);
    expect(result.missing).toContain('al menos un contenido');
  });

  it('con un solo contenido de cualquier tipo ya se puede publicar', () => {
    expect(publishability(moduleDetail({ videoFile: file })).publishable).toBe(true);
    expect(publishability(moduleDetail({ activities: [activity(1)] })).publishable).toBe(true);
    expect(
      publishability(
        moduleDetail({ presentationFile: { ...file, contentType: 'application/pdf' } }),
      ).publishable,
    ).toBe(true);
  });

  it('solo una actividad fuera del módulo no basta', () => {
    expect(
      publishability(moduleDetail({ activities: [activity(1, { status: 'fuera_del_plan' })] }))
        .publishable,
    ).toBe(false);
  });
});

describe('isEditorStepId', () => {
  it('acepta solo los pasos del editor', () => {
    expect(isEditorStepId('video')).toBe(true);
    expect(isEditorStepId('otro')).toBe(false);
    expect(isEditorStepId(null)).toBe(false);
  });
});
