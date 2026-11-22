import { RecordActor, UserRole } from '@gns/shared';
import type { RequestUser } from '../../core/audit/request-user';
import { actorsOf, canReviewGrade, isStaff } from './review-scope';

const user = (role: UserRole, id = 'u-1'): RequestUser => ({ id, role, sessionId: 's-1' });

describe('review scope', () => {
  it('lets coordination and administration view, never a teacher', () => {
    expect(isStaff(user(UserRole.Coordinator))).toBe(true);
    expect(isStaff(user(UserRole.Administrator))).toBe(true);
    expect(isStaff(user(UserRole.Teacher))).toBe(false);
  });

  it('lets only the coordinator of the grade review', () => {
    expect(canReviewGrade(user(UserRole.Coordinator, 'c-1'), 'c-1')).toBe(true);
    expect(canReviewGrade(user(UserRole.Coordinator, 'c-2'), 'c-1')).toBe(false);
    expect(canReviewGrade(user(UserRole.Administrator, 'c-1'), 'c-1')).toBe(false);
    expect(canReviewGrade(user(UserRole.Teacher, 'c-1'), 'c-1')).toBe(false);
  });

  it('lets nobody review a grade without a coordinator', () => {
    expect(canReviewGrade(user(UserRole.Coordinator), null)).toBe(false);
    expect(canReviewGrade(user(UserRole.Administrator), null)).toBe(false);
  });

  it('builds the actors from ownership and the coordinator of the grade', () => {
    expect(actorsOf(user(UserRole.Teacher, 't-1'), 't-1', 'c-1')).toEqual([RecordActor.Owner]);
    expect(actorsOf(user(UserRole.Coordinator, 'c-1'), 't-1', 'c-1')).toEqual([
      RecordActor.Reviewer,
    ]);
    expect(actorsOf(user(UserRole.Coordinator, 'c-2'), 't-1', 'c-1')).toEqual([]);
    expect(actorsOf(user(UserRole.Administrator, 'a-1'), 't-1', 'c-1')).toEqual([]);
  });
});
