import {
  DRAFT_VERSION,
  draftKey,
  isEmptyDraft,
  restoreDraft,
  serializeDraft,
  type ReviewDraft,
} from './review-draft';
import { UUID_A, UUID_B, makePlan } from './test-fixtures';

const PLAN = makePlan();

function makeDraft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    version: DRAFT_VERSION,
    planUpdatedAt: PLAN.updatedAt.toISOString(),
    adjustments: { closingMoment: 'Cierre ajustado.' },
    observations: { topic: 'Concreta el tema.' },
    general: 'Gracias.',
    savedAt: '2026-11-08T15:00:00.000Z',
    ...overrides,
  };
}

describe('draftKey', () => {
  it('es distinta por usuario y por planeación', () => {
    expect(draftKey(UUID_A, UUID_B)).not.toBe(draftKey(UUID_B, UUID_A));
    expect(draftKey(UUID_A, UUID_B)).toBe(`gns-revision:${UUID_A}:${UUID_B}`);
  });
});

describe('restoreDraft', () => {
  it('restaura lo guardado si la planeación sigue enviada y no cambió', () => {
    const draft = makeDraft();
    expect(restoreDraft(serializeDraft(draft), PLAN)).toEqual({ kind: 'restored', draft });
  });

  it('sin nada guardado no hace nada', () => {
    expect(restoreDraft(null, PLAN)).toEqual({ kind: 'none' });
  });

  it('descarta el borrador si la planeación cambió o ya no está enviada', () => {
    const raw = serializeDraft(makeDraft());
    expect(restoreDraft(raw, makePlan({ updatedAt: new Date('2026-11-09T10:00:00Z') }))).toEqual({
      kind: 'discarded',
      reason: 'changed',
    });
    expect(restoreDraft(raw, makePlan({ status: 'revisada' }))).toEqual({
      kind: 'discarded',
      reason: 'status',
    });
  });

  it('descarta lo ilegible, de otra versión o con una forma que no es la esperada', () => {
    const corrupt = { kind: 'discarded', reason: 'corrupt' };
    expect(restoreDraft('{no es json', PLAN)).toEqual(corrupt);
    expect(restoreDraft('[]', PLAN)).toEqual(corrupt);
    expect(restoreDraft(JSON.stringify({ ...makeDraft(), version: 99 }), PLAN)).toEqual(corrupt);
    expect(
      restoreDraft(JSON.stringify({ ...makeDraft(), adjustments: { topic: 3 } }), PLAN),
    ).toEqual(corrupt);
  });
});

describe('isEmptyDraft', () => {
  it('un borrador sin ajustes, observaciones ni general está vacío', () => {
    expect(isEmptyDraft({ adjustments: {}, observations: { topic: '  ' }, general: '' })).toBe(
      true,
    );
    expect(isEmptyDraft(makeDraft())).toBe(false);
    expect(isEmptyDraft({ adjustments: {}, observations: {}, general: 'Hola' })).toBe(false);
  });
});
