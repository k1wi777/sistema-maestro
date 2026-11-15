import { printTitle } from './print';
import { makePlan } from './test-fixtures';

describe('print title', () => {
  it('names the document after the area and the topic', () => {
    expect(printTitle(makePlan())).toBe('Planeación – English (CLIL) – Sweet Home: my family');
  });

  it('falls back when the plan has no topic', () => {
    expect(printTitle(makePlan({ topic: null }))).toBe('Planeación – English (CLIL) – sin tema');
    expect(printTitle(makePlan({ topic: '   ' }))).toBe('Planeación – English (CLIL) – sin tema');
  });
});
