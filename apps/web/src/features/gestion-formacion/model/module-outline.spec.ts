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

  it('lista todas las secciones en orden, también las vacías', () => {
    const groups = moduleGroups(tree);
    expect(groups.map((group) => group.section.title)).toEqual([
      'Fundamentos',
      'Parte 2',
      'Práctica',
    ]);
    expect(groups.map((group) => group.modules.length)).toEqual([2, 0, 1]);
  });

  it('un plan de área con una sola sección trae su encabezado', () => {
    const groups = moduleGroups(planTree([section(1, [outline(1)], 'Módulos del área')]));
    expect(groups).toHaveLength(1);
    expect(groups[0]?.section.title).toBe('Módulos del área');
  });

  it('sin secciones no hay grupos', () => {
    expect(moduleGroups(planTree([]))).toEqual([]);
  });
});
