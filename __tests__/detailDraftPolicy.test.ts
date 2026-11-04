import {
  PENDING_EDIT_NOTICE,
  hasPendingEditDraft,
  shouldClearDraftOnDetailClose,
} from '../src/core/history/detailDraftPolicy';

describe('shouldClearDraftOnDetailClose', () => {
  test('clears the draft when the calculation was finished in the wizard', () => {
    expect(
      shouldClearDraftOnDetailClose({
        fromWizard: true,
        draftEditId: 'calc-1',
        calcId: 'calc-1',
      }),
    ).toBe(true);
    expect(
      shouldClearDraftOnDetailClose({
        fromWizard: true,
        draftEditId: null,
        calcId: 'calc-1',
      }),
    ).toBe(true);
  });

  test('keeps an unfinished edit when Sulje is pressed without fromWizard', () => {
    expect(
      shouldClearDraftOnDetailClose({
        fromWizard: false,
        draftEditId: 'calc-1',
        calcId: 'calc-1',
      }),
    ).toBe(false);
  });

  test('does not clear a draft that belongs to another calculation', () => {
    expect(
      shouldClearDraftOnDetailClose({
        fromWizard: false,
        draftEditId: 'calc-2',
        calcId: 'calc-1',
      }),
    ).toBe(false);
    expect(
      shouldClearDraftOnDetailClose({
        fromWizard: false,
        draftEditId: null,
        calcId: 'calc-1',
      }),
    ).toBe(false);
  });
});

describe('hasPendingEditDraft', () => {
  const record = { id: 'calc-1' };

  test('is true when a newer edit draft points at this calculation', () => {
    expect(
      hasPendingEditDraft(record, { editCalculationId: 'calc-1', updatedAt: 9000 }),
    ).toBe(true);
  });

  test('is false without a draft, for another calculation, or without a record', () => {
    expect(hasPendingEditDraft(record, null)).toBe(false);
    expect(hasPendingEditDraft(record, { editCalculationId: 'calc-2' })).toBe(false);
    expect(hasPendingEditDraft(null, { editCalculationId: 'calc-1' })).toBe(false);
    expect(hasPendingEditDraft(record, { editCalculationId: '  ' })).toBe(false);
  });

  test('notice text is the Finnish unsaved-changes label', () => {
    expect(PENDING_EDIT_NOTICE).toBe('Tallentamattomia muutoksia');
  });
});
