import { TrainingActivityType } from '@gns/shared';

import { activityBlocks } from './activity-blocks';
import { uuid } from './test-fixtures';
import {
  makeSimulatorActivity,
  makeTeacherActivity,
  makeTrueOrMythActivity,
  makeWheelActivity,
} from './test-fixtures-activities';

describe('activityBlocks', () => {
  it('keeps the order of the API with one block per non-simulator activity', () => {
    const blocks = activityBlocks([
      makeWheelActivity({ id: uuid(1) }),
      makeTeacherActivity({ id: uuid(2) }),
      makeTrueOrMythActivity({ id: uuid(3) }),
    ]);

    expect(blocks.map((block) => [block.kind, block.key])).toEqual([
      ['activity', uuid(1)],
      ['activity', uuid(2)],
      ['activity', uuid(3)],
    ]);
  });

  it('groups consecutive simulators into a single block', () => {
    const blocks = activityBlocks([
      makeWheelActivity({ id: uuid(1) }),
      makeSimulatorActivity({ id: uuid(2) }),
      makeSimulatorActivity({ id: uuid(3) }),
      makeSimulatorActivity({ id: uuid(4) }),
      makeTeacherActivity({ id: uuid(5) }),
    ]);

    expect(blocks.map((block) => block.kind)).toEqual(['activity', 'simulators', 'activity']);
    const group = blocks[1];
    expect(group?.kind === 'simulators' && group.simulators.map((s) => s.activity.id)).toEqual([
      uuid(2),
      uuid(3),
      uuid(4),
    ]);
  });

  it('starts a new simulator block after another activity', () => {
    const blocks = activityBlocks([
      makeSimulatorActivity({ id: uuid(1) }),
      makeTeacherActivity({ id: uuid(2) }),
      makeSimulatorActivity({ id: uuid(3) }),
    ]);

    expect(blocks.map((block) => block.kind)).toEqual(['simulators', 'activity', 'simulators']);
  });

  it('shows an invalid simulator as unavailable and breaks the group', () => {
    const blocks = activityBlocks([
      makeSimulatorActivity({ id: uuid(1) }),
      makeSimulatorActivity({ id: uuid(2), config: { entradas: [] } }),
      makeSimulatorActivity({ id: uuid(3) }),
    ]);

    expect(blocks.map((block) => block.kind)).toEqual(['simulators', 'unavailable', 'simulators']);
  });

  it('returns nothing without activities and keeps the type constant in use', () => {
    expect(activityBlocks([])).toEqual([]);
    expect(makeSimulatorActivity().type).toBe(TrainingActivityType.Simulator);
  });
});
