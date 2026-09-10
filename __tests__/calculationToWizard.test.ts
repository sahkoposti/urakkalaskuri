import { calculationToFormState } from '../src/core/wizard/calculationToWizard';
import { buildFormSnapshot } from '../src/core/form/formSummaryHelpers';
import type { CalculationRecord, Product } from '../src/core/models/types';

const product: Product = {
  id: 'prod-1',
  name: 'Maali',
  unit: 'l',
  unitPriceVat0: 12,
  createdAt: new Date('2026-01-01'),
};

function sampleRecord(fieldValues?: Record<string, string>): CalculationRecord {
  return {
    id: 'calc-1',
    projectName: 'Testitalo',
    customer: JSON.stringify({ customerType: 'private', reverseVat: false }),
    groupDurationHours: 40,
    crewSize: 2,
    hourlyRate: 30,
    marginPercent: 35,
    commissionPercent: 7,
    contractPriceVat0: 2400,
    materialsVat0: 100,
    marginEur: 900,
    commissionEur: 180,
    totalPriceVat0: 3480,
    vatPercent: 25.5,
    vatAmount: 887.4,
    totalPriceVat: 4367.4,
    workDurationDays: 5,
    discountPercent: 0,
    discountEur: 0,
    totalPriceVatBeforeDiscount: 4367.4,
    totalPriceVat0BeforeDiscount: 3480,
    createdAt: new Date('2026-01-01'),
    formSnapshot: fieldValues
      ? {
          formId: 'default',
          formVersion: 1,
          fields: [],
          fieldValues,
        }
      : undefined,
    lines: [
      {
        id: 'line-1',
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        unitPriceVat0: product.unitPriceVat0,
        quantity: 2,
        lineTotalVat0: 24,
      },
    ],
  };
}

describe('calculationToFormState', () => {
  test('restores raw fieldValues from formSnapshot including hidden and overrides', () => {
    const fieldValues = {
      kiintea_seinapinta_ala_m2: '120',
      raystaan_aluset_ja_otsalaudat: 'false',
      raystasmetrit: '14',
      kaytettava_maali: product.id,
      laskenta_seinapinta_ala_m2: '110',
      tyoryhma_kesto_pv: '4,5',
    };

    const { form, wizardDraft } = calculationToFormState(
      sampleRecord(fieldValues),
      [product],
    );

    expect(form.customerName).toBe('Testitalo');
    expect(form.fieldValues).toEqual(fieldValues);
    expect(form.duration).toBe('4,5');
    expect(form.lines).toHaveLength(1);
    expect(form.lines[0]?.product.id).toBe(product.id);
    expect(wizardDraft.customer.name).toBe('Testitalo');
  });

  test('restores postal code and locality from saved customer json', () => {
    const record = sampleRecord();
    record.customer = JSON.stringify({
      customerType: 'private',
      reverseVat: false,
      address: 'Katu 1',
      postalCode: '20780',
      postalLocality: 'Kaarina',
    });
    const { form, wizardDraft } = calculationToFormState(record, [product]);
    expect(form.customerAddress).toBe('Katu 1');
    expect(form.customerPostalCode).toBe('20780');
    expect(form.customerPostalLocality).toBe('Kaarina');
    expect(wizardDraft.customer.postalLocality).toBe('Kaarina');
  });

  test('restores one-way travel time hours', () => {
    const record = sampleRecord();
    record.travelTimeHoursOneWay = 0.75;
    const { form } = calculationToFormState(record, [product]);
    expect(form.travelTimeOneWay).toBe('0,75');
  });

  test('falls back to workDurationDays when snapshot has no fieldValues', () => {
    const { form } = calculationToFormState(sampleRecord(undefined), [product]);
    expect(form.fieldValues.tyoryhma_kesto_pv).toBe('5');
    expect(form.duration).toBe('5');
    expect(form.fieldValues.kiintea_seinapinta_ala_m2).toBeUndefined();
  });
});

describe('buildFormSnapshot fieldValues round-trip', () => {
  test('stores raw fieldValues including keys omitted from display fields', () => {
    const form = {
      id: 'f1',
      name: 'T',
      version: 1,
      updatedAt: 0,
      pages: [{ id: 'p1', title: 'Sivu', sortOrder: 0, fieldIds: ['a', 'b'] }],
      fields: [
        {
          id: 'a',
          key: 'nakyva',
          label: 'Näkyvä',
          type: 'number' as const,
          required: false,
          showOnSummary: true,
        },
        {
          id: 'b',
          key: 'piilotettu',
          label: 'Piilotettu',
          type: 'number' as const,
          required: false,
          showOnSummary: false,
        },
      ],
    };

    const fieldValues = { nakyva: '10', piilotettu: '99', override: '1' };
    const snapshot = buildFormSnapshot(form, fieldValues, { nakyva: 10 });

    expect(snapshot.fieldValues).toEqual(fieldValues);
    expect(snapshot.fields.map((f) => f.key)).toEqual(['nakyva']);
  });
});
