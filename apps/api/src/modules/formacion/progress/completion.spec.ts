import { isModuleComplete } from './completion';
import type { CompletionSnapshot } from './training-progress.repository';

const DONE = new Date('2026-11-09T10:00:00.000Z');

const complete: CompletionSnapshot = {
  moduleCompletedAt: null,
  videoUrl: 'https://youtu.be/x',
  presentationUrl: null,
  slideCount: 3,
  questionCount: 5,
  videoViewedAt: DONE,
  presentationViewedAt: DONE,
  passedAt: DONE,
  requiredActivities: [{ id: 'a', completedAt: DONE }],
};

describe('isModuleComplete', () => {
  it('is complete when every required step is done', () => {
    expect(isModuleComplete(complete)).toBe(true);
  });

  it.each([
    ['the video', { videoViewedAt: null }],
    ['the presentation', { presentationViewedAt: null }],
    ['the approved challenge', { passedAt: null }],
    ['a required activity', { requiredActivities: [{ id: 'a', completedAt: null }] }],
  ])('is not complete without %s', (_name, change) => {
    expect(isModuleComplete({ ...complete, ...change })).toBe(false);
  });

  it('ignores the steps the module does not have', () => {
    expect(
      isModuleComplete({
        ...complete,
        videoUrl: null,
        videoViewedAt: null,
        slideCount: 0,
        presentationViewedAt: null,
        questionCount: 0,
        passedAt: null,
        requiredActivities: [],
      }),
    ).toBe(true);
  });

  it('asks for the presentation when there is only a link to it', () => {
    const linkOnly = { ...complete, slideCount: 0, presentationUrl: 'https://gns.test/p' };

    expect(isModuleComplete({ ...linkOnly, presentationViewedAt: null })).toBe(false);
    expect(isModuleComplete(linkOnly)).toBe(true);
  });
});
