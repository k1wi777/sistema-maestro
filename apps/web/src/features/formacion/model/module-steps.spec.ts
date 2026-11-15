import { finishList, moduleSections } from './module-steps';
import { DATE, makeModule, uuid } from './test-fixtures';
import { makeTeacherActivity } from './test-fixtures-activities';

const complete = () =>
  makeModule({
    videoSource: 'youtube',
    videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
    slides: [{ id: uuid(40), title: 'Uno', keyIdeas: null }],
    challenge: { questionCount: 6, approvalThreshold: 80, secondsPerQuestion: null },
    activities: [
      makeTeacherActivity({ id: uuid(5), title: 'Obligatoria', isRequired: true }),
      makeTeacherActivity({ id: uuid(6), title: 'Opcional', isRequired: false }),
    ],
  });

describe('moduleSections', () => {
  it('numbers every section of a complete module consecutively', () => {
    expect(moduleSections(complete())).toEqual([
      { kind: 'video', number: 1 },
      { kind: 'challenge', number: 2 },
      { kind: 'presentation', number: 3 },
      { kind: 'activities', number: 4 },
    ]);
  });

  it('renumbers when contents are missing', () => {
    const item = makeModule({
      challenge: { questionCount: 3, approvalThreshold: 80, secondsPerQuestion: null },
      presentationUrl: 'https://example.org/p',
    });

    expect(moduleSections(item)).toEqual([
      { kind: 'challenge', number: 1 },
      { kind: 'presentation', number: 2 },
    ]);
  });

  it('works with a single content of each type', () => {
    expect(moduleSections(makeModule({ videoSource: 'archivo' }))).toEqual([
      { kind: 'video', number: 1 },
    ]);
    expect(
      moduleSections(
        makeModule({ presentationFile: { id: uuid(9), name: null, contentType: 'x', size: 1 } }),
      ),
    ).toEqual([{ kind: 'presentation', number: 1 }]);
    expect(
      moduleSections(makeModule({ activities: [makeTeacherActivity({ id: uuid(5) })] })),
    ).toEqual([{ kind: 'activities', number: 1 }]);
  });

  it('returns no sections for an empty module', () => {
    expect(moduleSections(makeModule())).toEqual([]);
    expect(finishList(makeModule())).toEqual({ items: [], hasOptionalNote: false });
  });
});

describe('finishList', () => {
  it('lists the same contents as the sections, with required activities only', () => {
    const list = finishList(complete());

    expect(list.items.map((item) => item.key)).toEqual([
      'video',
      'challenge',
      'presentation',
      uuid(5),
    ]);
    expect(list.items.every((entry) => !entry.done)).toBe(true);
    expect(list.hasOptionalNote).toBe(true);
  });

  it('shows the needed and current percentage of the challenge', () => {
    const item = complete();
    const none = finishList(item).items[1];
    const some = finishList({
      ...item,
      progress: { ...item.progress, bestScore: 67 },
    }).items[1];

    expect(none?.label).toBe('Desafío GNS · necesitas 80%, aún sin intentos');
    expect(some?.label).toBe('Desafío GNS · necesitas 80%, llevas 67%');
  });

  it('marks each item from its own progress', () => {
    const item = complete();
    const list = finishList({
      ...item,
      progress: {
        ...item.progress,
        videoViewedAt: DATE,
        passedAt: DATE,
        presentationViewedAt: DATE,
      },
      activities: item.activities.map((activity) => ({
        ...activity,
        progress: { ...activity.progress, completedAt: DATE },
      })),
    });

    expect(list.items.every((entry) => entry.done)).toBe(true);
  });

  it('has no optional note when every activity is required', () => {
    const item = makeModule({
      activities: [makeTeacherActivity({ id: uuid(5), isRequired: true })],
    });

    expect(finishList(item).hasOptionalNote).toBe(false);
  });
});
