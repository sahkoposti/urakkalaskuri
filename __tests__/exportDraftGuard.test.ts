import fs from 'fs';
import path from 'path';

import { buildCalculationRecordFromComposer } from '@/src/core/wizard/buildCalculationRecord';
import { createMinimalFormDefinition } from '@/src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '@/src/core/form/formDefinitionHelpers';
import { defaultSettings, emptyCustomerInfo } from '@/src/core/models/types';
import { emptyStructureLine, type ProductStructure } from '@/src/core/structure/types';
import { buildPersistedWizardDraft, type WizardFormState } from '@/src/core/wizard/wizardDraftHelpers';
import {
  CONTINUE_EDIT_LABEL,
  EXPORT_BLOCKED_BY_DRAFT_MESSAGE,
  isExportBlockedByEditDraft,
  shouldClearDraftOnDetailClose,
} from '@/src/core/history/detailDraftPolicy';

const form = normalizeFormDefinition(createMinimalFormDefinition());
const structure: ProductStructure = {
  id: 's-seina',
  name: 'Seinämaalaus (testi)',
  unit: 'm',
  form,
  commissionPercent: 0,
  crewSize: 1,
  sortOrder: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function wallLine(meters: string) {
  const quantity = Number(meters);
  return {
    ...emptyStructureLine({ id: 'L1', structure, vatPercent: 25.5 }),
    fieldValues: { seina_m: meters },
    quantity,
    unitPriceVat0: 40,
    formFilled: true,
  };
}

function formState(meters: string): WizardFormState {
  return {
    step: 0,
    customerName: 'Testi Asiakas',
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
    structureLines: [wallLine(meters)],
  };
}

describe('isExportBlockedByEditDraft', () => {
  const record = buildCalculationRecordFromComposer({
    id: 'calc-1',
    customer: { ...emptyCustomerInfo(), name: 'Testi Asiakas' },
    structureLines: [wallLine('6')],
    settings: defaultSettings,
    products: [],
    structures: [structure],
    createdAt: new Date('2026-03-01T12:00:00Z'),
  });
  const draft = buildPersistedWizardDraft(formState('12'), { editCalculationId: record.id });

  test('blocks export when the draft for this calculation still has the new meters', () => {
    expect(record.structureLines?.[0]?.fieldValues?.seina_m).toBe('6');
    expect(draft.structureLines?.[0]?.fieldValues?.seina_m).toBe('12');
    expect(record.structureLines?.[0]?.quantity).toBe(6);
    expect(draft.structureLines?.[0]?.quantity).toBe(12);
    expect(isExportBlockedByEditDraft(draft, record.id)).toBe(true);
    expect(EXPORT_BLOCKED_BY_DRAFT_MESSAGE).toBe(
      'Tarjous tehdään tallennetuilla tiedoilla, joissa on vanhat hinnat. Tallenna muutokset ensin Yhteenvedossa.',
    );
    expect(CONTINUE_EDIT_LABEL).toBe('Jatka muokkausta');
  });

  test('does not block another calculation or a missing draft', () => {
    expect(isExportBlockedByEditDraft(draft, 'calc-muu')).toBe(false);
    expect(isExportBlockedByEditDraft(null, record.id)).toBe(false);
    const other = buildPersistedWizardDraft(formState('12'), { editCalculationId: 'calc-muu' });
    expect(isExportBlockedByEditDraft(other, record.id)).toBe(false);
  });

  test('is not blocked after Sulje from a finished wizard clears the draft', () => {
    const clear = shouldClearDraftOnDetailClose({
      fromWizard: true,
      draftEditId: draft.editCalculationId,
      calcId: record.id,
    });
    expect(clear).toBe(true);
    const draftAfterClose = clear ? null : draft;
    expect(isExportBlockedByEditDraft(draftAfterClose, record.id)).toBe(false);
  });

  test('stays blocked when Sulje is not from the wizard, so the draft is kept', () => {
    expect(
      shouldClearDraftOnDetailClose({
        fromWizard: false,
        draftEditId: draft.editCalculationId,
        calcId: record.id,
      }),
    ).toBe(false);
    expect(isExportBlockedByEditDraft(draft, record.id)).toBe(true);
  });
});

describe('PdfExportButtons uses the export guard', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/components/pdf/PdfExportButtons.tsx'),
    'utf8',
  );

  test('the render path shows the blocked message and continue button', () => {
    expect(source).toContain('isExportBlockedByEditDraft(wizardDraft, calculationId)');
    expect(source).toContain('{EXPORT_BLOCKED_BY_DRAFT_MESSAGE}');
    expect(source).toContain('title={CONTINUE_EDIT_LABEL}');
    expect(source).toContain("pathname: '/wizard'");
    expect(source).not.toContain('vie silti');
  });

  test('offer and urakkakortti handlers return before the PDF calls when blocked', () => {
    const offerStart = source.indexOf('const handleTarjous');
    const cardStart = source.indexOf('const handleUrakkakortti');
    const offer = source.slice(offerStart, source.indexOf('await exportTarjousPdf', offerStart));
    const card = source.slice(cardStart, source.indexOf('await exportUrakkakorttiPdf', cardStart));
    expect(offer).toContain('if (exportBlocked) return;');
    expect(card).toContain('if (exportBlocked) return;');
    expect(source).toContain('disabled={\n          exportBlocked ||');
    expect(source).toContain('disabled={exportBlocked || busy !== null || cardProblems.length > 0}');
  });
});
