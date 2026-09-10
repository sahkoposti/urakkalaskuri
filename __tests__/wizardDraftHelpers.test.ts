import {
  buildPersistedWizardDraft,
  composerHasUnsavedChanges,
  composerStateSignature,
  fieldValuesEqual,
  firstNonEmptyId,
  mergeWizardDraftEditMeta,
  persistedDraftToFormState,
  serializeFieldValues,
  shouldKeepResumeDraftOnLeave,
} from '../src/core/wizard/wizardDraftHelpers';
import type { Product } from '../src/core/models/types';

const product: Product = {
  id: 'prod-1',
  name: 'Maali',
  unit: 'l',
  unitPriceVat0: 10,
  createdAt: new Date('2026-01-01'),
};

describe('firstNonEmptyId', () => {
  test('returns the first usable id', () => {
    expect(firstNonEmptyId(undefined, ['  '], 'keep-me', 'later')).toBe('keep-me');
    expect(firstNonEmptyId(['hist-1'])).toBe('hist-1');
    expect(firstNonEmptyId(undefined, null, '')).toBeUndefined();
  });
});

describe('mergeWizardDraftEditMeta', () => {
  test('never drops a known calculation id from a later incomplete write', () => {
    const merged = mergeWizardDraftEditMeta(
      { originalCreatedAt: 99 },
      { editCalculationId: 'calc-keep', originalCreatedAt: 1, editFormVersion: 4 },
    );
    expect(merged.editCalculationId).toBe('calc-keep');
    expect(merged.originalCreatedAt).toBe(99);
    expect(merged.editFormVersion).toBe(4);
  });
});

describe('wizard draft edit metadata', () => {
  test('persists and restores calculation id so Laske updates the same row', () => {
    const createdAt = new Date('2026-03-01T12:00:00Z');
    const persisted = buildPersistedWizardDraft(
      {
        step: 1,
        customerName: 'Matti',
        customerType: 'private',
        reverseVat: false,
        customerPhone: '',
        customerEmail: '',
        customerAddress: '',
        customerPostalCode: '',
        customerPostalLocality: '',
        customerNotes: '',
        duration: '2',
        fieldValues: { tyoryhma_kesto_pv: '2' },
        lines: [],
      },
      {
        editCalculationId: 'calc-existing',
        originalCreatedAt: createdAt,
        editFormVersion: 7,
      },
    );

    expect(persisted.editCalculationId).toBe('calc-existing');
    expect(persisted.originalCreatedAt).toBe(createdAt.getTime());
    expect(persisted.editFormVersion).toBe(7);

    const restored = persistedDraftToFormState(persisted, [product]);
    expect(restored.form.customerName).toBe('Matti');
    expect(firstNonEmptyId(persisted.editCalculationId)).toBe('calc-existing');
  });

  test('keeps previous calculation id when a later write omits it', () => {
    const previous = buildPersistedWizardDraft(
      {
        step: 0,
        customerName: 'Matti',
        customerType: 'private',
        reverseVat: false,
        customerPhone: '',
        customerEmail: '',
        customerAddress: '',
        customerPostalCode: '',
        customerPostalLocality: '',
        customerNotes: '',
        duration: '',
        fieldValues: {},
        lines: [],
      },
      {
        editCalculationId: 'calc-existing',
        originalCreatedAt: 1_700_000_000_000,
        editFormVersion: 3,
      },
    );

    const next = buildPersistedWizardDraft(
      {
        step: 0,
        customerName: 'Matti päivitetty',
        customerType: 'private',
        reverseVat: false,
        customerPhone: '',
        customerEmail: '',
        customerAddress: '',
        customerPostalCode: '',
        customerPostalLocality: '',
        customerNotes: '',
        duration: '',
        fieldValues: {},
        lines: [],
      },
      undefined,
      previous,
    );

    expect(next.editCalculationId).toBe('calc-existing');
    expect(next.originalCreatedAt).toBe(1_700_000_000_000);
    expect(next.editFormVersion).toBe(3);
  });

  test('route edit id wins over a stale previous draft id', () => {
    const previous = buildPersistedWizardDraft(
      {
        step: 0,
        customerName: 'Vanha',
        customerType: 'private',
        reverseVat: false,
        customerPhone: '',
        customerEmail: '',
        customerAddress: '',
        customerPostalCode: '',
        customerPostalLocality: '',
        customerNotes: '',
        duration: '',
        fieldValues: {},
        lines: [],
      },
      { editCalculationId: 'calc-old' },
    );
    const next = buildPersistedWizardDraft(
      {
        step: 0,
        customerName: 'Uusi kohde',
        customerType: 'private',
        reverseVat: false,
        customerPhone: '',
        customerEmail: '',
        customerAddress: '',
        customerPostalCode: '',
        customerPostalLocality: '',
        customerNotes: '',
        duration: '',
        fieldValues: {},
        lines: [],
      },
      { editCalculationId: 'calc-from-route' },
      previous,
    );
    expect(next.editCalculationId).toBe('calc-from-route');
  });

  test('omits edit id for a brand new calculation draft', () => {
    const persisted = buildPersistedWizardDraft({
      step: 0,
      customerName: 'Uusi',
      customerType: 'private',
      reverseVat: false,
      customerPhone: '',
      customerEmail: '',
      customerAddress: '',
      customerPostalCode: '',
      customerPostalLocality: '',
      customerNotes: '',
      duration: '',
      fieldValues: {},
      lines: [],
    });
    expect(persisted.editCalculationId).toBeUndefined();
  });

  test('persists and restores postal code and locality', () => {
    const persisted = buildPersistedWizardDraft({
      step: 0,
      customerName: 'Matti',
      customerType: 'private',
      reverseVat: false,
      customerPhone: '',
      customerEmail: '',
      customerAddress: 'Katu 1',
      customerPostalCode: '20100',
      customerPostalLocality: 'Turku',
      customerNotes: '',
      duration: '',
      fieldValues: {},
      lines: [],
    });
    const restored = persistedDraftToFormState(persisted, [product]);
    expect(restored.form.customerPostalCode).toBe('20100');
    expect(restored.form.customerPostalLocality).toBe('Turku');
    expect(restored.wizardDraft.customer.postalCode).toBe('20100');
    expect(restored.wizardDraft.customer.postalLocality).toBe('Turku');
  });
});

function emptyForm(partial: Partial<import('../src/core/wizard/wizardDraftHelpers').WizardFormState> = {}) {
  return {
    step: 0,
    customerName: '',
    customerType: 'private' as const,
    reverseVat: false,
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    customerPostalCode: '',
    customerPostalLocality: '',
    customerNotes: '',
    duration: '',
    fieldValues: {},
    lines: [],
    ...partial,
  };
}

function sampleLine(partial: Partial<import('../src/core/models/types').StructureLine> = {}) {
  return {
    id: 'l1',
    structureId: 's1',
    name: 'Maalaus',
    quantity: 1,
    unitPriceVat0: 100,
    materialsVat0: 20,
    discountPercent: 0,
    vatPercent: 25.5,
    contractPriceVat0: 80,
    workDurationDays: 2,
    commissionPercent: 7,
    commissionEur: 7,
    marginEur: 50,
    marginPercent: 10,
    fieldValues: { pinta: '12' },
    formFilled: true,
    overrides: [],
    ...partial,
  };
}

describe('serializeFieldValues', () => {
  test('ignores empty values and key order', () => {
    expect(serializeFieldValues({ b: '2', a: '1', empty: '  ' })).toBe(
      serializeFieldValues({ a: '1', b: '2' }),
    );
    expect(fieldValuesEqual({ pinta: '12', extra: '' }, { pinta: '12' })).toBe(true);
  });
});

describe('composer unsaved changes', () => {
  test('does not prompt when the current state matches the saved snapshot', () => {
    const saved = emptyForm({
      customerName: 'Matti',
      deliveryScheduleText: 'vko 42',
      structureLines: [sampleLine()],
    });
    const current = emptyForm({
      customerName: 'Matti',
      deliveryScheduleText: 'vko 42',
      structureLines: [sampleLine({ marginEur: 999, marginPercent: 99 })],
    });
    expect(composerHasUnsavedChanges(current, composerStateSignature(saved))).toBe(false);
  });

  test('prompts when a saved calculation has been edited', () => {
    const saved = emptyForm({ customerName: 'Matti', structureLines: [sampleLine()] });
    const current = emptyForm({
      customerName: 'Matti',
      deliveryScheduleText: 'huomenna',
      structureLines: [sampleLine()],
    });
    expect(composerHasUnsavedChanges(current, composerStateSignature(saved))).toBe(true);
  });

  test('does not prompt for an empty new calculation', () => {
    expect(composerHasUnsavedChanges(emptyForm(), null)).toBe(false);
  });

  test('prompts for unsaved content before the first snapshot', () => {
    expect(composerHasUnsavedChanges(emptyForm({ customerName: 'Matti' }), null)).toBe(true);
  });
});

describe('shouldKeepResumeDraftOnLeave', () => {
  test('drops the resume banner when a completed calculation was opened without edits', () => {
    const opened = emptyForm({
      customerName: 'Matti',
      deliveryScheduleText: 'vko 42',
      structureLines: [sampleLine()],
    });
    const origin = composerStateSignature(opened);
    expect(
      shouldKeepResumeDraftOnLeave({
        resumedIncompleteDraft: false,
        currentSignature: composerStateSignature(opened),
        originSignature: origin,
      }),
    ).toBe(false);
  });

  test('keeps the resume banner when a completed calculation was edited', () => {
    const opened = emptyForm({ customerName: 'Matti', structureLines: [sampleLine()] });
    const edited = emptyForm({
      customerName: 'Matti',
      deliveryScheduleText: 'huomenna',
      structureLines: [sampleLine()],
    });
    expect(
      shouldKeepResumeDraftOnLeave({
        resumedIncompleteDraft: false,
        currentSignature: composerStateSignature(edited),
        originSignature: composerStateSignature(opened),
      }),
    ).toBe(true);
  });

  test('keeps an originally incomplete draft even without further edits', () => {
    const draft = emptyForm({ customerName: 'Kesken', structureLines: [sampleLine()] });
    expect(
      shouldKeepResumeDraftOnLeave({
        resumedIncompleteDraft: true,
        currentSignature: composerStateSignature(draft),
        originSignature: composerStateSignature(draft),
      }),
    ).toBe(true);
  });

  test('drops an empty new calculation', () => {
    const empty = emptyForm();
    expect(
      shouldKeepResumeDraftOnLeave({
        resumedIncompleteDraft: false,
        currentSignature: composerStateSignature(empty),
        originSignature: composerStateSignature(empty),
      }),
    ).toBe(false);
  });
});
