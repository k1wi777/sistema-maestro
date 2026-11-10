import { AuditLogType, UserRole } from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import type { AuditEntry, AuditLogService } from '../../auditoria/audit-log.service';
import { TrainingMilestones } from './training-milestones';

const user: RequestUser = { id: 'u1', role: UserRole.Teacher, sessionId: 's1' };
const DATE = new Date('2026-11-09T10:00:00.000Z');

function setup() {
  const record = jest.fn<Promise<void>, [AuditEntry]>().mockResolvedValue(undefined);
  return { milestones: new TrainingMilestones({ record } as unknown as AuditLogService), record };
}

describe('TrainingMilestones', () => {
  it('writes every milestone as a training entry of the session user', async () => {
    const { milestones, record } = setup();

    await milestones.challengeStarted(user, 'p1', 'm1');
    await milestones.challengeFinished(user, 'at1', 'm1', {
      score: 80,
      points: 3000,
      passed: true,
    });
    await milestones.activityStarted(user, 'ap1', 'a1');
    await milestones.activityFinished(user, 'ap1', 'a1', { score: 50, points: 900, passed: false });
    await milestones.videoViewed(user, 'p1', 'm1', DATE);
    await milestones.presentationViewed(user, 'p1', 'm1', DATE);
    await milestones.activityCompleted(user, 'ap1', 'a1', DATE);
    await milestones.moduleCompleted(user, 'p1', 'm1', DATE);

    expect(record.mock.calls.map(([entry]) => entry.action)).toEqual([
      'Inició el Desafío GNS',
      'Terminó el Desafío GNS',
      'Inició una actividad',
      'Terminó una actividad',
      'Vio el video',
      'Revisó la presentación',
      'Completó una actividad',
      'Terminó un módulo',
    ]);
    for (const [entry] of record.mock.calls) {
      expect(entry).toMatchObject({
        userId: 'u1',
        role: UserRole.Teacher,
        type: AuditLogType.Training,
      });
    }
  });

  it('records the result of a game with its score and whether it passed, nothing else', async () => {
    const { milestones, record } = setup();

    await milestones.challengeFinished(user, 'at1', 'm1', {
      score: 80,
      points: 3000,
      passed: true,
    });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'intento_desafio',
        entityId: 'at1',
        dataAfter: { moduleId: 'm1', score: 80, points: 3000, passed: true },
      }),
    );
  });

  it('has no milestone for answers, next steps, stamps or simulator values', () => {
    const { milestones } = setup();

    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(milestones)).sort()).toEqual(
      [
        'constructor',
        'record',
        'challengeStarted',
        'challengeFinished',
        'activityStarted',
        'activityFinished',
        'videoViewed',
        'presentationViewed',
        'activityCompleted',
        'moduleCompleted',
      ].sort(),
    );
  });
});
