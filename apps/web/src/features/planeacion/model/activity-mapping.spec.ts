import {
  activityLinkResource,
  activityToPlanContent,
  appendToMoment,
  planToActivityDraft,
} from './activity-mapping';
import { makeActivity, makePlan, makeValues } from './test-fixtures';

describe('activity to plan', () => {
  it('maps the activity content and the corner for a level without CurioCity', () => {
    const { content, clipped } = activityToPlanContent(makeActivity(), 'Primaria');
    expect(content).toEqual({
      topic: 'Family puppets show',
      expectedPerformance: 'Presentar a la familia con títeres.',
      developmentMoment: '1. Armamos los títeres.\n2. Presentamos.',
      resources: 'Títeres de papel.',
      learningCorner: 'Sweet Home',
    });
    expect(clipped).toEqual([]);
  });

  it('does not copy the corner into a high school plan', () => {
    const { content } = activityToPlanContent(makeActivity(), 'Bachillerato');
    expect(content).not.toHaveProperty('learningCorner');
  });

  it('skips empty fields and clips what exceeds the maximum', () => {
    const { content, clipped } = activityToPlanContent(
      makeActivity({ objective: null, materials: null, title: 'T'.repeat(200) }),
      'Primaria',
    );
    expect(content).not.toHaveProperty('expectedPerformance');
    expect(content).not.toHaveProperty('resources');
    expect(content.topic).toHaveLength(160);
    expect(clipped).toEqual(['topic']);
  });

  it('turns the link into an "Otra" resource at moment 2', () => {
    expect(activityLinkResource(makeActivity())).toEqual({
      tool: 'Otra',
      name: 'Family puppets show',
      url: 'https://www.canva.com/',
      moment: 2,
    });
    expect(activityLinkResource(makeActivity({ link: null }))).toBeNull();
  });

  it('clips the resource name to 120 characters', () => {
    expect(activityLinkResource(makeActivity({ title: 'N'.repeat(150) }))?.name).toHaveLength(120);
  });
});

describe('plan to activity', () => {
  it('maps content, grade, area and corner and never the reasonable adjustments', () => {
    const { values } = planToActivityDraft(
      makePlan({ reasonableAdjustments: 'Apoyo visual para un estudiante.' }),
    );
    expect(values.title).toBe('Sweet Home: my family');
    expect(values.objective).toBe('Presenta a su familia.');
    expect(values.gradeId).toBe('33333333-3333-4333-8333-333333333333');
    expect(values.areaId).toBe('22222222-2222-4222-8222-222222222222');
    expect(values.levelId).toBe('');
    expect(values.learningCorner).toBe('Sweet Home');
    expect(values.materials).toBe('Títeres, parlante.');
    expect(values.activityType).toBe('actividad');
    expect(JSON.stringify(values)).not.toContain('estudiante');
  });

  it('builds the steps from the written moments with their names', () => {
    const { values } = planToActivityDraft(makePlan());
    expect(values.steps).toBe(
      '1. Exploración: Canción de saludo.\n\n2. Desarrollo: Títeres de la familia.',
    );
  });

  it('falls back to area and grade as the title and clips long steps', () => {
    const { values, clipped } = planToActivityDraft(
      makePlan({
        topic: null,
        developmentMoment: 'x'.repeat(4000),
        explorationMoment: 'y'.repeat(100),
      }),
    );
    expect(values.title).toBe('English (CLIL) · Transition');
    expect(values.steps).toHaveLength(4000);
    expect(clipped).toContain('steps');
  });
});

describe('planToActivityDraft with several areas', () => {
  const areas = [
    { id: '22222222-2222-4222-8222-222222222222', name: 'English (CLIL)' },
    { id: '33333333-3333-4333-8333-333333333333', name: 'Pre-ciencias' },
  ];

  it('proposes the first area and names the title after all of them', () => {
    const { values } = planToActivityDraft(makePlan({ topic: null, areas }));
    expect(values.areaId).toBe(areas[0]?.id);
    expect(values.title).toBe('English (CLIL), Pre-ciencias · Transition');
  });
});

describe('appendToMoment', () => {
  const activity = { title: 'Ruleta de emociones', steps: '1. Girar.\n2. Nombrar.' };

  it('appends to an empty moment without leading blank lines', () => {
    const result = appendToMoment(makeValues(), 'closingMoment', activity);
    expect(result.ok && result.values.closingMoment).toBe(
      '«Ruleta de emociones»\n1. Girar.\n2. Nombrar.',
    );
  });

  it('keeps what was written and separates the idea with a blank line', () => {
    const values = makeValues({ developmentMoment: 'Texto previo.\n' });
    const result = appendToMoment(values, 'developmentMoment', activity);
    expect(result.ok && result.values.developmentMoment).toBe(
      'Texto previo.\n\n«Ruleta de emociones»\n1. Girar.\n2. Nombrar.',
    );
  });

  it('does not modify the other moments', () => {
    const values = makeValues({ explorationMoment: 'Intacto.' });
    const result = appendToMoment(values, 'closingMoment', activity);
    expect(result.ok && result.values.explorationMoment).toBe('Intacto.');
  });

  it('refuses to exceed the maximum and explains it', () => {
    const values = makeValues({ closingMoment: 'z'.repeat(3990) });
    const result = appendToMoment(values, 'closingMoment', activity);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain('Momento 4');
    expect(!result.ok && result.message).toContain('4000');
  });
});
