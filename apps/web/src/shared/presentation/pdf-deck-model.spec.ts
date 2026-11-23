import {
  MAX_CANVAS_PIXELS,
  classifyPdfError,
  clampPage,
  isCancellation,
  loadPercent,
  planRender,
} from './pdf-deck-model';

describe('clampPage', () => {
  it('lleva la página al rango del documento', () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(9, 5)).toBe(5);
    expect(clampPage(3, 5)).toBe(3);
    expect(clampPage(2.6, 5)).toBe(3);
  });

  it('con un documento vacío devuelve 1', () => {
    expect(clampPage(4, 0)).toBe(1);
  });
});

describe('planRender', () => {
  const page = { pageWidth: 595, pageHeight: 842 };

  it('ajusta al ancho cuando la altura sobra', () => {
    const plan = planRender({ ...page, containerWidth: 300, maxHeight: 2000, devicePixelRatio: 1 });
    expect(plan.cssWidth).toBeCloseTo(300);
    expect(plan.cssHeight).toBeCloseTo((842 / 595) * 300);
    expect(plan.scale).toBeCloseTo(300 / 595);
  });

  it('ajusta a la altura máxima cuando el ancho sobra (contain)', () => {
    const plan = planRender({ ...page, containerWidth: 1000, maxHeight: 400, devicePixelRatio: 1 });
    expect(plan.cssHeight).toBeCloseTo(400);
    expect(plan.cssWidth).toBeCloseTo((595 / 842) * 400);
  });

  it('acota la densidad de píxeles a 2', () => {
    const plan = planRender({ ...page, containerWidth: 300, maxHeight: 2000, devicePixelRatio: 3 });
    expect(plan.scale).toBeCloseTo((300 / 595) * 2);
  });

  it('nunca baja de densidad 1', () => {
    const plan = planRender({
      ...page,
      containerWidth: 300,
      maxHeight: 2000,
      devicePixelRatio: 0.5,
    });
    expect(plan.scale).toBeCloseTo(300 / 595);
  });

  it('limita el canvas a unos 16 millones de píxeles', () => {
    const plan = planRender({
      ...page,
      containerWidth: 6000,
      maxHeight: 9000,
      devicePixelRatio: 2,
    });
    expect(595 * plan.scale * (842 * plan.scale)).toBeLessThanOrEqual(MAX_CANVAS_PIXELS + 1);
  });
});

describe('classifyPdfError', () => {
  it('distingue un PDF dañado', () => {
    expect(classifyPdfError({ name: 'InvalidPDFException' }).kind).toBe('invalid');
    expect(classifyPdfError({ name: 'FormatError' }).message).toMatch(/dañado/);
  });

  it('distingue un PDF con contraseña', () => {
    const failure = classifyPdfError({ name: 'PasswordException' });
    expect(failure.kind).toBe('password');
    expect(failure.message).toMatch(/contraseña/);
  });

  it('reconoce una URL firmada vencida por el estado de la respuesta', () => {
    expect(classifyPdfError({ name: 'ResponseException', status: 403 }).kind).toBe('expired');
    expect(classifyPdfError({ name: 'ResponseException', status: 400 }).kind).toBe('expired');
  });

  it('trata otras respuestas y los fallos de red como conexión', () => {
    expect(classifyPdfError({ name: 'ResponseException', status: 500 }).kind).toBe('network');
    expect(classifyPdfError(new TypeError('Failed to fetch')).kind).toBe('network');
    expect(classifyPdfError(undefined).message).toMatch(/conexión/);
  });
});

describe('isCancellation', () => {
  it('reconoce el dibujo cancelado', () => {
    expect(isCancellation({ name: 'RenderingCancelledException' })).toBe(true);
    expect(isCancellation(new Error('x'))).toBe(false);
  });
});

describe('loadPercent', () => {
  it('calcula el porcentaje o devuelve null sin tamaño', () => {
    expect(loadPercent(50, 200)).toBe(25);
    expect(loadPercent(500, 200)).toBe(100);
    expect(loadPercent(10, undefined)).toBeNull();
    expect(loadPercent(10, 0)).toBeNull();
  });
});
