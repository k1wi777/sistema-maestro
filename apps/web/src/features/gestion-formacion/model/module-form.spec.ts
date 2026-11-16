import {
  DATA_STEP_FIELDS,
  PRESENTATION_STEP_FIELDS,
  VIDEO_STEP_FIELDS,
  buildModulePatch,
  mapModuleApiErrors,
  suggestNextNumber,
  toModuleFormValues,
  validateNewModule,
} from './module-form';
import { moduleDetail } from './test-fixtures';

const saved = toModuleFormValues(moduleDetail({ summary: 'Resumen', approvalThreshold: 80 }));

describe('buildModulePatch', () => {
  it('sin cambios no envía nada', () => {
    expect(buildModulePatch(saved, { ...saved }, DATA_STEP_FIELDS)).toEqual({ kind: 'unchanged' });
    expect(
      buildModulePatch(saved, { ...saved, title: '  Módulo de prueba ' }, DATA_STEP_FIELDS),
    ).toEqual({ kind: 'unchanged' });
  });

  it('envía solo los campos cambiados del paso, con números y nulos bien tipados', () => {
    const result = buildModulePatch(
      saved,
      {
        ...saved,
        title: 'Nuevo título',
        approvalThreshold: '70',
        secondsPerQuestion: '30',
        summary: '',
      },
      DATA_STEP_FIELDS,
    );
    expect(result).toEqual({
      kind: 'patch',
      body: { title: 'Nuevo título', approvalThreshold: 70, secondsPerQuestion: 30, summary: null },
      fields: ['title', 'summary', 'approvalThreshold', 'secondsPerQuestion'],
    });
  });

  it('un cambio fuera de los campos del paso no se envía', () => {
    expect(
      buildModulePatch(
        saved,
        { ...saved, videoUrl: 'https://youtu.be/abcdefghijk' },
        DATA_STEP_FIELDS,
      ),
    ).toEqual({ kind: 'unchanged' });
  });

  it('valida con mensajes en español', () => {
    const bad = buildModulePatch(
      saved,
      { ...saved, title: ' ', approvalThreshold: '120', secondsPerQuestion: '2' },
      DATA_STEP_FIELDS,
    );
    expect(bad.kind).toBe('invalid');
    if (bad.kind === 'invalid') {
      expect(bad.errors.title).toBe('Escribe el título del módulo.');
      expect(bad.errors.approvalThreshold).toBe('Escribe un porcentaje entero entre 0 y 100.');
      expect(bad.errors.secondsPerQuestion).toContain('entre 5 y 120');
    }
  });

  it('el video por enlace solo admite YouTube y la presentación solo https', () => {
    const video = buildModulePatch(
      saved,
      { ...saved, videoUrl: 'https://vimeo.com/123' },
      VIDEO_STEP_FIELDS,
    );
    expect(video.kind === 'invalid' && video.errors.videoUrl).toContain('YouTube');
    const ok = buildModulePatch(
      saved,
      { ...saved, videoUrl: 'https://youtu.be/abcdefghijk', videoTitle: 'Bienvenida' },
      VIDEO_STEP_FIELDS,
    );
    expect(ok).toMatchObject({
      kind: 'patch',
      body: { videoUrl: 'https://youtu.be/abcdefghijk', videoTitle: 'Bienvenida' },
    });
    const presentation = buildModulePatch(
      saved,
      { ...saved, presentationUrl: 'http://example.com/a' },
      PRESENTATION_STEP_FIELDS,
    );
    expect(presentation.kind === 'invalid' && presentation.errors.presentationUrl).toContain(
      'https://',
    );
    expect(
      buildModulePatch(
        saved,
        { ...saved, presentationUrl: 'https://example.com/a' },
        PRESENTATION_STEP_FIELDS,
      ),
    ).toMatchObject({ kind: 'patch', body: { presentationUrl: 'https://example.com/a' } });
  });

  it('quitar el enlace de video lo envía como null', () => {
    const withVideo = toModuleFormValues(
      moduleDetail({ videoUrl: 'https://youtu.be/abcdefghijk' }),
    );
    expect(
      buildModulePatch(withVideo, { ...withVideo, videoUrl: '' }, VIDEO_STEP_FIELDS),
    ).toMatchObject({
      kind: 'patch',
      body: { videoUrl: null },
    });
  });

  it('cambiar de parte envía sectionId', () => {
    const next = '00000000-0000-4000-8000-000000000999';
    expect(buildModulePatch(saved, { ...saved, sectionId: next }, DATA_STEP_FIELDS)).toMatchObject({
      kind: 'patch',
      body: { sectionId: next },
    });
  });
});

describe('validateNewModule', () => {
  it('pide número y título, y la parte solo cuando hace falta', () => {
    const missing = validateNewModule({ number: '', title: '', sectionId: '' }, true);
    expect(missing).toEqual({
      ok: false,
      errors: {
        number: 'Escribe el número del módulo.',
        title: 'Escribe el título del módulo.',
        sectionId: 'Elige la parte del plan.',
      },
    });
    expect(validateNewModule({ number: '1', title: 'Hola', sectionId: '' }, false).ok).toBe(true);
  });

  it('arma el cuerpo con los valores por defecto de la API', () => {
    const result = validateNewModule({ number: ' 3 ', title: ' Rutinas ', sectionId: 'x' }, false);
    expect(result).toMatchObject({
      ok: true,
      input: { number: '3', title: 'Rutinas', summary: null, approvalThreshold: 80 },
    });
  });

  it('el número admite hasta 4 caracteres', () => {
    const result = validateNewModule({ number: '12345', title: 'x', sectionId: '' }, false);
    expect(result.ok === false && result.errors.number).toContain('4');
  });
});

describe('suggestNextNumber', () => {
  it('es el mayor número más uno', () => {
    expect(suggestNextNumber(['0', '1', '10', null, 'A'])).toBe('11');
    expect(suggestNextNumber([])).toBe('1');
  });
});

describe('mapModuleApiErrors', () => {
  it('separa los errores de campo de los demás', () => {
    expect(
      mapModuleApiErrors([
        { field: 'title', reason: 'no puede estar vacío' },
        { field: 'otro', reason: 'algo' },
      ]),
    ).toEqual({ fields: { title: 'No puede estar vacío' }, other: ['algo'] });
  });
});
