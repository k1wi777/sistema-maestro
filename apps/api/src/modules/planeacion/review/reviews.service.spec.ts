import {
  ApiErrorCode,
  ReviewAction,
  ReviewDecision,
  ReviewRecordType,
  type Review,
} from '@gns/shared';
import { ApiCodedException } from '../../../core/http/api-coded.exception';
import type { NewReview, ReviewRepository } from './review.repository';
import { ReviewsService } from './reviews.service';

const RECORD = { recordType: ReviewRecordType.LessonPlan, recordId: 'plan-1', reviewerId: 'rev-1' };

function setup(stored: Review[] = []) {
  const inserted: NewReview[] = [];
  const repository = {
    insert: jest.fn((review: NewReview) => {
      inserted.push(review);
      return Promise.resolve();
    }),
    findByRecord: jest.fn(() => Promise.resolve(stored)),
  } satisfies ReviewRepository;
  return { service: new ReviewsService(repository), inserted, repository };
}

function review(action: ReviewAction, at: string, id: string): Review {
  return {
    id,
    action,
    comment: null,
    reviewer: { id: 'rev-1', fullName: 'Coordinadora Uno' },
    date: new Date(at),
    adjustedFields: [],
    changes: [],
  };
}

describe('ReviewsService.record', () => {
  it('inserta solo la decisión cuando no hay ajustes', async () => {
    const { service, inserted } = setup();

    await service.record({
      ...RECORD,
      decision: ReviewDecision.Approved,
      comment: 'Bien',
      changes: [],
    });

    expect(inserted).toEqual([
      expect.objectContaining({
        action: ReviewAction.Approved,
        comment: 'Bien',
        adjustedFields: [],
        changes: null,
      }),
    ]);
  });

  it('inserta la fila de ajuste antes que la decisión, con la misma fecha y las columnas cambiadas', async () => {
    const { service, inserted } = setup();
    const changes = [{ field: 'tema', before: 'A', after: 'B' }];

    await service.record({
      ...RECORD,
      decision: ReviewDecision.ChangesRequested,
      comment: 'Revisa el tema',
      changes,
    });

    expect(inserted.map((row) => row.action)).toEqual([
      ReviewAction.Adjustment,
      ReviewAction.ChangesRequested,
    ]);
    expect(inserted[0]).toMatchObject({ comment: null, adjustedFields: ['tema'], changes });
    expect(inserted[1]).toMatchObject({ comment: 'Revisa el tema', adjustedFields: [] });
    expect(inserted[0]?.date).toBe(inserted[1]?.date);
  });
});

describe('ReviewsService.assertNotSelfReview', () => {
  it('responde 403 autorrevision_no_permitida si el revisor es el autor', () => {
    const { service } = setup();

    expect(() => service.assertNotSelfReview('u-1', 'u-1')).toThrow(ApiCodedException);
    try {
      service.assertNotSelfReview('u-1', 'u-1');
    } catch (error) {
      expect(error).toMatchObject({ code: ApiErrorCode.SelfReviewForbidden });
      expect((error as ApiCodedException).getStatus()).toBe(403);
    }
  });

  it('deja pasar a otra persona', () => {
    const { service } = setup();

    expect(() => service.assertNotSelfReview('u-1', 'u-2')).not.toThrow();
  });
});

describe('ReviewsService.history', () => {
  it('ordena por fecha y, con la misma fecha, el ajuste antes que su decisión', async () => {
    const same = '2026-11-09T10:00:00Z';
    const { service } = setup([
      review(ReviewAction.Approved, same, 'decision'),
      review(ReviewAction.Adjustment, same, 'ajuste'),
      review(ReviewAction.ChangesRequested, '2026-11-08T10:00:00Z', 'anterior'),
    ]);

    const history = await service.history(ReviewRecordType.LessonPlan, 'plan-1');

    expect(history.map((row) => row.id)).toEqual(['anterior', 'ajuste', 'decision']);
  });
});
