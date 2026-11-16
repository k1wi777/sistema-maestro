import { contentSummary, moduleGroups, trackingText } from './module-outline';
import { outline, planTree, section } from './test-fixtures';

describe('contentSummary', () => {
  it('resume desafío, diapositivas y actividades con su plural', () => {
    expect(contentSummary({ questionCount: 6, slideCount: 5, activityCount: 1 })).toBe(
      'Desafío (6 preguntas) · Presentación (5 diapositivas) · 1 actividad',
    );
    expect(contentSummary({ questionCount: 1, slideCount: 1, activityCount: 8 })).toBe(
      'Desafío (1 pregunta) · Presentación (1 diapositiva) · 8 actividades',
    );
  });

  it('sin contenidos lo dice', () => {
    expect(contentSummary({ questionCount: 0, slideCount: 0, activityCount: 0 })).toBe(
      'Sin contenidos todavía',
    );
  });
});

describe('trackingText', () => {
  it('cuenta terminados, en curso y docentes', () => {
    expect(trackingText({ done: 4, inProgress: 1 }, 6)).toBe(
      '4 terminados · 1 en curso · de 6 docentes',
    );
    expect(trackingText({ done: 1, inProgress: 0 }, 1)).toBe(
      '1 terminado · 0 en curso · de 1 docente',
    );
  });
});

describe('moduleGroups', () => {
  const tree = planTree([
    section(1, [outline(1), outline(2)], 'Fundamentos'),
    section(2, []),
    section(3, [outline(3)], 'Práctica'),
  ]);

  it('en el plan General agrupa por parte y omite las partes vacías', () => {
    const groups = moduleGroups(tree, true);
    expect(groups.map((group) => group.section?.title)).toEqual(['Fundamentos', 'Práctica']);
    expect(groups[0]?.modules).toHaveLength(2);
  });

  it('en un plan de área lista todo junto sin encabezado', () => {
    const groups = moduleGroups(tree, false);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.section).toBeNull();
    expect(groups[0]?.modules.map((module) => module.number)).toEqual(['1', '2', '3']);
  });

  it('sin módulos no hay grupos', () => {
    expect(moduleGroups(planTree([section(1, [])]), false)).toEqual([]);
  });
});
