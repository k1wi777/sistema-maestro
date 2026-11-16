import { completionSummary } from './completion-summary';
import { activity, ID, moduleDetail } from './test-fixtures';

describe('completionSummary', () => {
  it('sin contenido el docente termina con su primer avance', () => {
    expect(completionSummary(moduleDetail())).toEqual({ items: [], firstProgressOnly: true });
  });

  it('enumera video, Desafío con el umbral, presentación y actividades obligatorias activas', () => {
    const detail = moduleDetail({
      videoUrl: 'https://youtu.be/abcdefghijk',
      slides: [{ id: ID(1), sortOrder: 1, title: null, keyIdeas: 'a' }],
      questions: [
        {
          id: ID(2),
          sortOrder: 1,
          type: 'vf',
          prompt: 'p',
          feedback: null,
          trueFalseAnswer: true,
          options: [],
        },
      ],
      approvalThreshold: 70,
      activities: [
        activity(1, { isRequired: true }),
        activity(2, { isRequired: true }),
        activity(3, { isRequired: false }),
        activity(4, { isRequired: true, status: 'fuera_del_plan' }),
      ],
    });
    expect(completionSummary(detail).items).toEqual([
      'Ver el video.',
      'Aprobar el Desafío GNS con 70% o más.',
      'Revisar la presentación.',
      'Completar 2 actividades obligatorias.',
    ]);
  });

  it('refleja el umbral que se está escribiendo', () => {
    const detail = moduleDetail({
      questions: [
        {
          id: ID(2),
          sortOrder: 1,
          type: 'vf',
          prompt: 'p',
          feedback: null,
          trueFalseAnswer: true,
          options: [],
        },
      ],
    });
    expect(completionSummary(detail, 60).items).toEqual(['Aprobar el Desafío GNS con 60% o más.']);
  });

  it('solo opcionales: sigue siendo el primer avance', () => {
    const summary = completionSummary(moduleDetail({ activities: [activity(1)] }));
    expect(summary.firstProgressOnly).toBe(true);
  });
});
