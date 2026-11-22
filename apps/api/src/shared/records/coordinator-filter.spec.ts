import { gradeCoordinatorWhere } from './coordinator-filter';

describe('gradeCoordinatorWhere', () => {
  it('does not filter without a value', () => {
    expect(gradeCoordinatorWhere(undefined)).toBeUndefined();
  });

  it('filters by the coordinator id', () => {
    expect(gradeCoordinatorWhere('c-1')).toEqual({ coordinatorId: 'c-1' });
  });

  it('translates «none» to grades without a coordinator', () => {
    expect(gradeCoordinatorWhere('none')).toEqual({ coordinatorId: null });
  });
});
