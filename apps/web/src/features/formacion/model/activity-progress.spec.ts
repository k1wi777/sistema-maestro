import { progressText } from './activity-progress';
import { DATE, uuid } from './test-fixtures';
import { makeTeacherActivity, makeWheelActivity } from './test-fixtures-activities';

describe('progressText', () => {
  it('counts the stamps of the passport until it is complete', () => {
    const wheel = makeWheelActivity({ id: uuid(1) });

    expect(progressText(wheel)).toBe('0 de 3 sellos conseguidos');
    expect(progressText({ ...wheel, progress: { ...wheel.progress, stamps: ['a'] } })).toBe(
      '1 de 3 sellos conseguidos',
    );
    expect(progressText({ ...wheel, progress: { ...wheel.progress, completedAt: DATE } })).toBe(
      'Pasaporte completo',
    );
  });

  it('shows the best score or that the activity is done', () => {
    const base = makeTeacherActivity();

    expect(progressText(base)).toBe('Sin empezar');
    expect(progressText({ ...base, progress: { ...base.progress, bestScore: 60 } })).toBe(
      'Mejor resultado 60%',
    );
    expect(
      progressText({ ...base, progress: { ...base.progress, bestScore: 90, completedAt: DATE } }),
    ).toBe('Terminada · mejor resultado 90%');
    expect(progressText({ ...base, progress: { ...base.progress, completedAt: DATE } })).toBe(
      'Terminada',
    );
  });
});
