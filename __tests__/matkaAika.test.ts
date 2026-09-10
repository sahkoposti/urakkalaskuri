import {
  previewFormContext,
  runFormCalculation,
} from '../src/core/calculation/calculationPipeline';
import {
  LASKELMA_MATKA_AIKA_H,
  parseMatkaAikaH,
  resolveTravelTimeHours,
} from '../src/core/form/calculationFormulaContext';
import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition, unknownFormulaIdentifiers } from '../src/core/form/formDefinitionHelpers';
import { buildDebugFieldValues } from '../src/core/form/pipeline';
import { defaultSettings } from '../src/core/models/types';
import { calculationToFormState } from '../src/core/wizard/calculationToWizard';
import {
  buildPersistedWizardDraft,
  persistedDraftToFormState,
} from '../src/core/wizard/wizardDraftHelpers';
import type { CalculationRecord, Product } from '../src/core/models/types';

const paint: Product = {
  id: '15a3a629-b764-4e10-bf5e-3ce5e298c1e2',
  name: 'Ulkomaali',
  unit: 'l',
  unitPriceVat0: 8,
  attributes: { consumption: 8, work_factor: 1 },
  createdAt: new Date('2026-01-01'),
};

function defaultForm() {
  return normalizeFormDefinition(createDefaultFormDefinition());
}

describe('parseMatkaAikaH', () => {
  test('empty, invalid and negative values are 0', () => {
    expect(parseMatkaAikaH(undefined)).toBe(0);
    expect(parseMatkaAikaH(null)).toBe(0);
    expect(parseMatkaAikaH('')).toBe(0);
    expect(parseMatkaAikaH('  ')).toBe(0);
    expect(parseMatkaAikaH('abc')).toBe(0);
    expect(parseMatkaAikaH(-1)).toBe(0);
    expect(parseMatkaAikaH('-0,5')).toBe(0);
  });

  test('parses Finnish decimals', () => {
    expect(parseMatkaAikaH('0,75')).toBeCloseTo(0.75, 5);
    expect(parseMatkaAikaH(1.5)).toBeCloseTo(1.5, 5);
  });
});

describe('resolveTravelTimeHours', () => {
  test('keeps an explicit empty calculation-level value', () => {
    expect(
      resolveTravelTimeHours({
        travelTimeHours: '',
        fieldValues: { etaisyys: '0.25' },
      }),
    ).toBe('');
  });

  test('migrates etaisyys from snapshot or first structure line', () => {
    expect(resolveTravelTimeHours({ fieldValues: { etaisyys: '0,75' } })).toBe('0,75');
    expect(
      resolveTravelTimeHours({
        structureLines: [{ fieldValues: { etaisyys: '0.25' } }],
      }),
    ).toBe('0.25');
  });
});

describe('julkisivumaalaus matka-aika', () => {
  test('default form has no etaisyys question and uses laskelma.matka_aika_h', () => {
    const form = defaultForm();
    expect(form.version).toBe(112);
    expect(form.fields.some((field) => field.key === 'etaisyys')).toBe(false);
    expect(form.pages[0]?.fieldIds).not.toContain('field_mt9uscef_aizypl');

    const matka = form.fields.find((field) => field.key === 'matka_henkilotyotunnit');
    expect(matka?.formula).toBe(
      'laskelma.matka_aika_h * 2 * tyoryhma_kesto_pv * asetukset.tyoryhman_koko',
    );
    expect(matka?.allowManualOverride).toBe(false);
    expect(unknownFormulaIdentifiers(form, matka?.formula ?? '')).toEqual([]);
  });

  test('empty travel time is 0; round trip uses laskelma.matka_aika_h * 2', () => {
    const form = defaultForm();
    const fieldValues = {
      ...buildDebugFieldValues(form),
      henkilonostin_valinta: 'false',
    };

    const empty = previewFormContext(form, fieldValues, [], [paint], defaultSettings);
    expect(empty[LASKELMA_MATKA_AIKA_H]).toBe(0);
    expect(empty.matka_henkilotyotunnit).toBe(0);

    const crew = defaultSettings.defaultCrewSize;
    const withTravel = runFormCalculation({
      form,
      fieldValues,
      materialLines: [],
      products: [paint],
      settings: defaultSettings,
      calculation: { matkaAikaH: '0,75' },
    });

    expect(withTravel.context[LASKELMA_MATKA_AIKA_H]).toBeCloseTo(0.75, 5);
    expect(withTravel.context.matka_henkilotyotunnit).toBeCloseTo(
      0.75 * 2 * withTravel.context.tyoryhma_kesto_pv * crew,
      5,
    );
    expect(withTravel.context.matkakustannus_alv0).toBeCloseTo(
      withTravel.context.matka_henkilotyotunnit * 25,
      5,
    );
  });
});

describe('wizard draft travel time', () => {
  test('persists and restores travelTimeHours', () => {
    const persisted = buildPersistedWizardDraft({
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
      travelTimeHours: '0,75',
    });
    expect(persisted.travelTimeHours).toBe('0,75');
    const restored = persistedDraftToFormState(persisted, []);
    expect(restored.form.travelTimeHours).toBe('0,75');
  });

  test('migrates etaisyys from an old draft without travelTimeHours', () => {
    const persisted = buildPersistedWizardDraft({
      step: 0,
      customerName: '',
      customerType: 'private',
      reverseVat: false,
      customerPhone: '',
      customerEmail: '',
      customerAddress: '',
      customerPostalCode: '',
      customerPostalLocality: '',
      customerNotes: '',
      duration: '',
      fieldValues: { etaisyys: '0.25' },
      lines: [],
    });
    delete persisted.travelTimeHours;
    const restored = persistedDraftToFormState(persisted, []);
    expect(restored.form.travelTimeHours).toBe('0.25');
  });
});

describe('calculationToFormState travel time', () => {
  test('migrates etaisyys from a saved line when travelTimeHours is missing', () => {
    const record: CalculationRecord = {
      id: 'calc-1',
      projectName: 'Kohde',
      customer: JSON.stringify({ customerType: 'private', reverseVat: false }),
      groupDurationHours: 8,
      crewSize: 2,
      hourlyRate: 30,
      marginPercent: 0,
      commissionPercent: 7,
      contractPriceVat0: 100,
      materialsVat0: 0,
      marginEur: 0,
      commissionEur: 0,
      totalPriceVat0: 100,
      vatPercent: 25.5,
      vatAmount: 25.5,
      totalPriceVat: 125.5,
      workDurationDays: 1,
      discountPercent: 0,
      discountEur: 0,
      totalPriceVatBeforeDiscount: 125.5,
      totalPriceVat0BeforeDiscount: 100,
      createdAt: new Date('2026-01-01'),
      lines: [],
      structureLines: [
        {
          id: 'l1',
          structureId: 's1',
          name: 'Maalaus',
          quantity: 1,
          unitPriceVat0: 100,
          materialsVat0: 0,
          discountPercent: 0,
          vatPercent: 25.5,
          contractPriceVat0: 80,
          workDurationDays: 1,
          commissionPercent: 7,
          commissionEur: 7,
          marginEur: 0,
          marginPercent: 0,
          fieldValues: { etaisyys: '0,5' },
          formFilled: true,
          overrides: [],
        },
      ],
    };
    const { form } = calculationToFormState(record, []);
    expect(form.travelTimeHours).toBe('0,5');
  });
});
