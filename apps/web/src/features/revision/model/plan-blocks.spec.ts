import { blockOfChangesError, blockOfField, planSections, reviewableBlocks } from './plan-blocks';

describe('planSections', () => {
  it('agrupa los bloques como en el tablero', () => {
    const sections = planSections('Primaria');
    expect(sections.map((section) => section.title)).toEqual([
      'Datos generales',
      'Propósito',
      'Momentos de la clase',
      'Recursos y ajustes razonables',
      'Recursos digitales',
    ]);
    expect(sections[2]?.blocks.map((block) => block.label)).toEqual([
      'Momento 1 · Exploración',
      'Momento 2 · Desarrollo',
      'Momento 3 · Socialización',
      'Momento 4 · Cierre',
    ]);
  });

  it('las dos fechas son un solo bloque', () => {
    const dates = planSections('Primaria')[0]?.blocks.find((block) => block.key === 'dates');
    expect(dates?.fields).toEqual(['dateFrom', 'dateTo']);
  });

  it('la etapa CurioCity solo está en bachillerato', () => {
    const keys = (level: string) => reviewableBlocks(level).map((block) => block.key);
    expect(keys('Bachillerato')).toContain('curiocityStage');
    expect(keys('Primaria')).not.toContain('curiocityStage');
    expect(keys('Nivel desconocido')).not.toContain('curiocityStage');
  });

  it('los recursos digitales no son ajustables ni observables', () => {
    expect(reviewableBlocks('Primaria').map((block) => block.key)).not.toContain('linkedResources');
    expect(planSections('Primaria').at(-1)?.blocks[0]?.fields).toEqual([]);
  });
});

describe('blockOfField y blockOfChangesError', () => {
  it('las fechas van al bloque de fechas y el resto a su propia clave', () => {
    expect(blockOfField('dateFrom')).toBe('dates');
    expect(blockOfField('dateTo')).toBe('dates');
    expect(blockOfField('closingMoment')).toBe('closingMoment');
  });

  it('traduce un error `changes.<campo>` de la API a su bloque', () => {
    expect(blockOfChangesError('changes.dateTo')).toBe('dates');
    expect(blockOfChangesError('changes.topic')).toBe('topic');
    expect(blockOfChangesError('comment')).toBeNull();
    expect(blockOfChangesError('changes.otro')).toBeNull();
  });
});
