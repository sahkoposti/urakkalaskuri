import {
  buildPersistedWizardDraft,
  firstNonEmptyId,
  persistedDraftToFormState,
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
