import { buildCalculationRecord, buildCalculationRecordFromComposer } from '@/src/core/wizard/buildCalculationRecord';
import { createDefaultFormDefinition } from '@/src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '@/src/core/form/formDefinitionHelpers';
import type { FormDefinition } from '@/src/core/form/types';
import type { AppSettings, Product, WizardDraft } from '@/src/core/models/types';
import { defaultSettings, emptyCustomerInfo } from '@/src/core/models/types';
import { emptyStructureLine } from '@/src/core/structure/types';

const form: FormDefinition = {
  id: 'test-form',
  name: 'Test',
  version: 3,
  pages: [{ id: 'p1', title: 'Sivu', sortOrder: 0, fieldIds: ['f1'] }],
  fields: [
    {
      id: 'f1',
      key: 'huoneet',
      label: 'Huoneet',
      type: 'number',
      required: false,
      showOnSummary: true,
    },
  ],
  updatedAt: 0,
};

const product: Product = {
  id: 'prod-1',
  name: 'Maali',
  unit: 'l',
  unitPriceVat0: 10,
  createdAt: new Date('2026-01-01'),
};

const settings: AppSettings = { ...defaultSettings };

function lineIdFactory() {
  let n = 0;
  return () => `line-${++n}`;
}

describe('buildCalculationRecord', () => {
  test('tallentaa asiakkaan, tuloksen ja lomakkeen snapshotin', () => {
    const draft: WizardDraft = {
      customer: {
        ...emptyCustomerInfo(),
        name: 'Matti Meikäläinen',
        phone: '040123',
      },
      groupDurationHours: 16,
      crewSize: 2,
      lines: [{ product, quantity: 3 }],
    };

    const record = buildCalculationRecord({
      id: 'calc-1',
      draft,
      result: {
        contractPriceVat0: 1000,
        materialsVat0: 30,
        marginEur: 200,
        commissionEur: 50,
        totalPriceVat0: 1280,
        vatAmount: 326.4,
        totalPriceVat: 1606.4,
        workDurationDays: 2,
        discountPercent: 0,
        discountEur: 0,
        totalPriceVatBeforeDiscount: 1606.4,
        totalPriceVat0BeforeDiscount: 1280,
      },
      settings,
      fieldValues: { huoneet: '4' },
      formDefinition: form,
      formContext: { huoneet: 4 },
      materialLines: draft.lines,
      products: [product],
      createdAt: new Date('2026-09-09T08:00:00Z'),
      createLineId: lineIdFactory(),
    });

    expect(record.id).toBe('calc-1');
    expect(record.projectName).toBe('Matti Meikäläinen');
    expect(record.groupDurationHours).toBe(16);
    expect(record.workDurationDays).toBe(2);
    expect(record.contractPriceVat0).toBe(1000);
    expect(record.formSnapshot?.formVersion).toBe(3);
    expect(record.formSnapshot?.fieldValues).toEqual({ huoneet: '4' });
    expect(record.lines).toEqual([
      {
        id: 'line-1',
        productId: 'prod-1',
        productName: 'Maali',
        unit: 'l',
        unitPriceVat0: 10,
        quantity: 3,
        lineTotalVat0: 30,
      },
    ]);
    expect(JSON.parse(record.customer ?? '{}')).toMatchObject({ phone: '040123' });
  });
});

describe('buildCalculationRecordFromComposer', () => {
  test('summaa rivit kokonaissummaksi ilman kestoa', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    const structure = {
      id: 'default',
      name: 'Ulkoverhoilun maalaus',
      form,
      commissionPercent: 7,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const line = {
      ...emptyStructureLine({ id: 'l1', structure, vatPercent: 25.5 }),
      unitPriceVat0: 100,
      quantity: 2,
      materialsVat0: 10,
      discountPercent: 0,
    };
    const record = buildCalculationRecordFromComposer({
      id: 'c1',
      customer: { ...emptyCustomerInfo(), name: 'Jaana' },
      deliveryScheduleText: 'viikko 42',
      structureLines: [line],
      settings,
      products: [],
      structures: [structure],
      createdAt: new Date('2026-09-09T08:00:00Z'),
    });
    expect(record.projectName).toBe('Jaana');
    expect(record.deliveryScheduleText).toBe('viikko 42');
    expect(record.totalPriceVat0).toBe(200);
    expect(record.workDurationDays).toBe(0);
    expect(record.structureLines).toHaveLength(1);
  });

  test('tallentaa lomakesnapshotin jokaiselle täytetylle riville', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    const structureA = {
      id: 'a',
      name: 'Ulkoverhoilu',
      form,
      commissionPercent: 7,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const structureB = {
      ...structureA,
      id: 'b',
      name: 'Sisämaalaus',
    };
    const lineA = {
      ...emptyStructureLine({ id: 'l1', structure: structureA, vatPercent: 25.5 }),
      fieldValues: { kiintea_seinapinta_ala_m2: '120', laudoitustyyppi: '1.15' },
      formFilled: true,
    };
    const lineB = {
      ...emptyStructureLine({ id: 'l2', structure: structureB, vatPercent: 25.5 }),
      fieldValues: { kiintea_seinapinta_ala_m2: '40', laudoitustyyppi: '1' },
      formFilled: true,
    };
    const record = buildCalculationRecordFromComposer({
      id: 'c2',
      customer: { ...emptyCustomerInfo(), name: 'Jaana' },
      structureLines: [lineA, lineB],
      settings,
      products: [],
      structures: [structureA, structureB],
      createdAt: new Date('2026-09-09T08:00:00Z'),
    });

    expect(record.structureLines).toHaveLength(2);
    expect(
      record.structureLines?.[0]?.snapshot?.fields.find(
        (field) => field.key === 'kiintea_seinapinta_ala_m2',
      )?.value,
    ).toContain('120');
    expect(
      record.structureLines?.[1]?.snapshot?.fields.find(
        (field) => field.key === 'kiintea_seinapinta_ala_m2',
      )?.value,
    ).toContain('40');
  });
});
