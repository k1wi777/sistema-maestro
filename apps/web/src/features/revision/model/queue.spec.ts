import { nextPendingPlan } from './queue';
import { UUID_A, UUID_B, UUID_C, UUID_D, makePlan } from './test-fixtures';

const REVIEWER = UUID_D;

describe('nextPendingPlan', () => {
  it('elige la primera enviada que no es la actual', () => {
    const plans = [makePlan({ id: UUID_A }), makePlan({ id: UUID_B }), makePlan({ id: UUID_C })];
    expect(nextPendingPlan(plans, UUID_A, REVIEWER)?.id).toBe(UUID_B);
  });

  it('salta las propias de quien revisa y las que no están enviadas', () => {
    const plans = [
      makePlan({ id: UUID_A, status: 'revisada' }),
      makePlan({ id: UUID_B, teacher: { id: REVIEWER, fullName: 'Coordinadora Demo' } }),
      makePlan({ id: UUID_C }),
    ];
    expect(nextPendingPlan(plans, 'otra', REVIEWER)?.id).toBe(UUID_C);
  });

  it('sin candidata devuelve null', () => {
    expect(nextPendingPlan([makePlan({ id: UUID_A })], UUID_A, REVIEWER)).toBeNull();
    expect(nextPendingPlan([], UUID_A, REVIEWER)).toBeNull();
  });
});
