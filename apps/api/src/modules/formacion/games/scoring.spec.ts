import { GAME_LATENCY_MARGIN_SECONDS } from '@gns/shared';
import { challengePoints, isLate, matchPoints, scorePercentage, trueOrMythPoints } from './scoring';

describe('game scoring', () => {
  it('gives 1000 points to an instant first correct challenge answer', () => {
    expect(challengePoints(0, 20, 1)).toBe(1000);
  });

  it('gives 500 base points after the time is used up', () => {
    expect(challengePoints(20, 20, 1)).toBe(500);
    expect(challengePoints(40, 20, 1)).toBe(500);
  });

  it('rewards speed proportionally', () => {
    expect(challengePoints(10, 20, 1)).toBe(750);
  });

  it.each([
    [1, 0],
    [2, 100],
    [3, 200],
    [5, 400],
    [9, 400],
  ])('adds the streak bonus for a streak of %i (%i points, capped at four)', (streak, bonus) => {
    expect(challengePoints(20, 20, streak)).toBe(500 + bonus);
  });

  it('scores conecta with the first-attempt bonus and streak only on the first try', () => {
    expect(matchPoints(true, 0, 30, 1)).toBe(400);
    expect(matchPoints(true, 0, 30, 3)).toBe(500);
    expect(matchPoints(false, 0, 30, 3)).toBe(200);
    expect(matchPoints(false, 30, 30, 0)).toBe(100);
  });

  it('scores true or myth', () => {
    expect(trueOrMythPoints(0, 10, 1)).toBe(500);
    expect(trueOrMythPoints(10, 10, 2)).toBe(250);
  });

  it('cuts at the allowed time plus the latency margin', () => {
    expect(isLate(20 + GAME_LATENCY_MARGIN_SECONDS, 20)).toBe(false);
    expect(isLate(20 + GAME_LATENCY_MARGIN_SECONDS + 0.01, 20)).toBe(true);
  });

  it('computes the score only from correct answers', () => {
    expect(scorePercentage(3, 4)).toBe(75);
    expect(scorePercentage(1, 3)).toBe(33);
    expect(scorePercentage(0, 0)).toBe(0);
  });
});
