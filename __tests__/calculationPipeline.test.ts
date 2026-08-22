import {
  CalculationValidationError,
  previewFormContext,
  runFormCalculation,
  runProductionPipeline,
} from '../src/core/calculation/calculationPipeline';
import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import { runDebugPipeline } from '../src/core/form/pipeline';
import type { Product } from '../src/core/models/types';
import { defaultSettings } from '../src/core/models/types';

function defaultForm() {
  return normalizeFormDefinition(createDefaultFormDefinition());
}

const paintProduct: Product = {
  id: 'paint-1',
  name: 'Maali',
  unit: 'l',
  unitPriceVat0: 12,
  attributes: { consumption: 8 },
  createdAt: new Date(),
};

const materialProduct: Product = {
  id: 'mat-1',
  name: 'Materiaali',
  unit: 'kpl',
  unitPriceVat0: 250,
  createdAt: new Date(),
};

describe('runProductionPipeline', () => {
  test('evaluates computed fields from user inputs', () => {
    const form = defaultForm();
    const context = runProductionPipeline(
      form,
      {
        kiintea_seinapinta_ala_m2: '120',
        aukkovahennykset: '18',
        laudoitustyyppi: '1.15',
        tyoryhma_kesto_pv: '5',
      },
      250,
      defaultSettings,
    );

    expect(context.laskenta_seinapinta_ala_m2).toBeCloseTo(117.3, 2);
    expect(context.materiaalirivit_yhteensa).toBe(250);
    expect(context['asetukset.tyopaivan_pituus']).toBe(defaultSettings.workdayHours);
    expect(context['settings.workday_hours']).toBe(defaultSettings.workdayHours);
  });

  test('exports product_select attributes to context', () => {
    const form = defaultForm();
    form.fields.push({
      id: 'field_paint',
      key: 'kautettavamaali',
      label: 'Maali',
      type: 'product_select',
      required: false,
      showOnSummary: true,
    });

    const context = runProductionPipeline(
      form,
      {
        kautettavamaali: 'paint-1',
        tyoryhma_kesto_pv: '5',
      },
      0,
      defaultSettings,
      [paintProduct],
    );

    expect(context['kautettavamaali.unit_price']).toBe(12);
    expect(context['kautettavamaali.yksikkohinta']).toBe(12);
    expect(context['kautettavamaali.consumption']).toBe(8);
    expect(context['kautettavamaali.menekki']).toBe(8);
  });
});

describe('runFormCalculation', () => {
  test('runs full calculation with form context', () => {
    const form = defaultForm();
    const { context, result } = runFormCalculation({
      form,
      fieldValues: {
        kiintea_seinapinta_ala_m2: '120',
        aukkovahennykset: '18',
        laudoitustyyppi: '1.15',
        tyoryhma_kesto_pv: '5',
      },
      materialLines: [{ product: materialProduct, quantity: 1 }],
      products: [],
      settings: defaultSettings,
    });

    expect(context.laskenta_seinapinta_ala_m2).toBeCloseTo(117.3, 2);
    expect(result.workDurationDays).toBeCloseTo(5, 2);
    expect(result.contractPriceVat0).toBeCloseTo(2400, 2);
    expect(result.totalPriceVat).toBeCloseTo(4568.97, 2);
  });

  test('includes product_quantity lines in materials', () => {
    const form = defaultForm();
    form.fields.push({
      id: 'field_paint_qty',
      key: 'maali_rivi',
      label: 'Maali',
      type: 'product_quantity',
      required: false,
      showOnSummary: true,
    });

    const { result, materialLines } = runFormCalculation({
      form,
      fieldValues: {
        kiintea_seinapinta_ala_m2: '120',
        laudoitustyyppi: '1.15',
        tyoryhma_kesto_pv: '5',
        maali_rivi: 'paint-1',
        maali_rivi__qty: '5',
      },
      materialLines: [],
      products: [paintProduct],
      settings: defaultSettings,
    });

    expect(materialLines).toHaveLength(1);
    expect(result.materialsVat0).toBeCloseTo(60, 2);
  });

  test('applies add_material effect from computed quantity', () => {
    const form = defaultForm();
    form.fields.push(
      {
        id: 'field_paint',
        key: 'kautettavamaali',
        label: 'Maali',
        type: 'product_select',
        required: false,
        showOnSummary: false,
      },
      {
        id: 'field_paint_amount',
        key: 'materiaali_maara',
        label: 'Maaramäärä',
        type: 'computed',
        required: false,
        showOnSummary: true,
        unit: 'l',
        formula: 'laskenta_seinapinta_ala_m2 / kautettavamaali.consumption',
        effects: [
          {
            type: 'add_material',
            productRef: 'kautettavamaali',
            quantityRef: 'materiaali_maara',
          },
        ],
      },
    );

    const { result, materialLines } = runFormCalculation({
      form,
      fieldValues: {
        kiintea_seinapinta_ala_m2: '120',
        aukkovahennykset: '18',
        laudoitustyyppi: '1.15',
        tyoryhma_kesto_pv: '5',
        kautettavamaali: 'paint-1',
      },
      materialLines: [],
      products: [paintProduct],
      settings: defaultSettings,
    });

    expect(materialLines).toHaveLength(1);
    expect(result.materialsVat0).toBeCloseTo(175.95, 2);
  });

  test('finnish product aliases calculate material price', () => {
    const form = defaultForm();
    form.fields.push(
      {
        id: 'field_paint',
        key: 'kaytettava_maali',
        label: 'Käytettävä maali',
        type: 'product_select',
        required: false,
        showOnSummary: false,
      },
      {
        id: 'field_paint_price',
        key: 'maali_hinta',
        label: 'Maalihinta',
        type: 'computed',
        required: false,
        showOnSummary: true,
        unit: '€',
        formula:
          'laskenta_seinapinta_ala_m2 / kaytettava_maali.menekki * kaytettava_maali.yksikkohinta',
        effects: [{ type: 'add_material_fixed', quantityRef: 'maali_hinta' }],
      },
    );

    const { result, context } = runFormCalculation({
      form,
      fieldValues: {
        kiintea_seinapinta_ala_m2: '120',
        aukkovahennykset: '18',
        laudoitustyyppi: '1.15',
        tyoryhma_kesto_pv: '5',
        kaytettava_maali: 'paint-1',
      },
      materialLines: [],
      products: [paintProduct],
      settings: defaultSettings,
    });

    expect(context.maali_hinta).toBeCloseTo(175.95, 2);
    expect(result.materialsVat0).toBeCloseTo(175.95, 2);
  });

  test('duration system formula can be computed from measurements', () => {
    const form = defaultForm();
    form.fields = form.fields.map((field) =>
      field.systemKey === 'tyoryhma_kesto_pv'
        ? { ...field, formula: 'laskenta_seinapinta_ala_m2 / 23.46', allowManualOverride: false }
        : field,
    );

    const { result, context } = runFormCalculation({
      form,
      fieldValues: {
        kiintea_seinapinta_ala_m2: '120',
        aukkovahennykset: '18',
        laudoitustyyppi: '1.15',
      },
      materialLines: [],
      products: [],
      settings: defaultSettings,
    });

    expect(context.tyoryhma_kesto_pv).toBeCloseTo(5, 2);
    expect(result.workDurationDays).toBeCloseTo(5, 2);
    expect(result.contractPriceVat0).toBeCloseTo(2400, 2);
  });

  test('requires duration when missing', () => {
    const form = defaultForm();
    expect(() =>
      runFormCalculation({
        form,
        fieldValues: {
          kiintea_seinapinta_ala_m2: '120',
          laudoitustyyppi: '1.15',
        },
        materialLines: [],
        products: [],
        settings: defaultSettings,
      }),
    ).toThrow(CalculationValidationError);
  });

  test('default system formulas produce expected totals', () => {
    const form = defaultForm();
    const { result, context } = runFormCalculation({
      form,
      fieldValues: {
        kiintea_seinapinta_ala_m2: '120',
        aukkovahennykset: '18',
        laudoitustyyppi: '1.15',
        tyoryhma_kesto_pv: '5',
      },
      materialLines: [{ product: materialProduct, quantity: 1 }],
      products: [],
      settings: defaultSettings,
    });

    expect(result.contractPriceVat0).toBeCloseTo(2400, 2);
    expect(result.totalPriceVat).toBeCloseTo(4568.97, 2);
    expect(result.totalPriceVat0).toBeCloseTo(3640.61, 2);
    expect(result.marginEur).toBeCloseTo(1599.14, 2);
    expect(result.commissionEur).toBeCloseTo(319.83, 2);
    expect(result.vatAmount).toBeCloseTo(928.36, 2);
    expect(result.marginEur / result.totalPriceVat).toBeCloseTo(0.35, 4);
    expect(context.kokonaishinta).toBeCloseTo(result.totalPriceVat, 2);
    expect(context.alv_maara).toBeCloseTo(result.vatAmount, 2);
  });

  test('rejects margin + commission >= 100%', () => {
    const form = defaultForm();
    expect(() =>
      runFormCalculation({
        form,
        fieldValues: { tyoryhma_kesto_pv: '5' },
        materialLines: [],
        products: [],
        settings: {
          ...defaultSettings,
          defaultMarginPercent: 60,
          defaultCommissionPercent: 40,
        },
      }),
    ).toThrow(CalculationValidationError);
  });

  test('uses edited system formulas for wizard price', () => {
    const form = defaultForm();
    form.fields = form.fields.map((field) =>
      field.systemKey === 'kokonaishinta'
        ? { ...field, formula: 'urakka_hinta_alv0 + materiaalit_alv0' }
        : field.systemKey === 'kokonaishinta_alv0'
          ? { ...field, formula: 'kokonaishinta' }
          : field.systemKey === 'alv_maara'
            ? { ...field, formula: '0' }
            : field.systemKey === 'myyntikate_eur'
              ? { ...field, formula: '0' }
              : field.systemKey === 'myyntipalkkio_eur'
                ? { ...field, formula: '0' }
                : field,
    );

    const { result } = runFormCalculation({
      form,
      fieldValues: { tyoryhma_kesto_pv: '5' },
      materialLines: [{ product: materialProduct, quantity: 1 }],
      products: [],
      settings: defaultSettings,
    });

    expect(result.contractPriceVat0).toBeCloseTo(2400, 2);
    expect(result.totalPriceVat).toBeCloseTo(2650, 2);
    expect(result.vatAmount).toBe(0);
  });

  test('reverseVat omits ALV from result', () => {
    const form = defaultForm();
    const { result, context } = runFormCalculation({
      form,
      fieldValues: { tyoryhma_kesto_pv: '5' },
      materialLines: [{ product: materialProduct, quantity: 1 }],
      products: [],
      settings: defaultSettings,
      reverseVat: true,
    });

    expect(result.vatAmount).toBe(0);
    expect(result.totalPriceVat0).toBeCloseTo(result.totalPriceVat, 2);
    expect(result.totalPriceVat).toBeCloseTo(context.kokonaishinta, 2);
  });

  test('debug pipeline agrees with wizard formulas on kokonaishinta', () => {
    const form = defaultForm();
    const fieldValues = {
      kiintea_seinapinta_ala_m2: '120',
      aukkovahennykset: '18',
      laudoitustyyppi: '1.15',
      tyoryhma_kesto_pv: '5',
    };

    const { context } = runFormCalculation({
      form,
      fieldValues,
      materialLines: [{ product: materialProduct, quantity: 1 }],
      products: [],
      settings: defaultSettings,
    });

    const debug = runDebugPipeline(form, 'kokonaishinta', {
      settings: defaultSettings,
      materialsVat0: 250,
    });

    expect(debug.errors).toHaveLength(0);
    expect(debug.context.kokonaishinta).toBeCloseTo(context.kokonaishinta, 2);
  });

  test('materialsVat0 comes from materiaalit_alv0 formula', () => {
    const form = defaultForm();
    form.fields = form.fields.map((field) =>
      field.systemKey === 'materiaalit_alv0' ? { ...field, formula: '100' } : field,
    );

    const { result, context } = runFormCalculation({
      form,
      fieldValues: { tyoryhma_kesto_pv: '5' },
      materialLines: [{ product: materialProduct, quantity: 1 }],
      products: [],
      settings: defaultSettings,
    });

    expect(context.materiaalit_alv0).toBe(100);
    expect(result.materialsVat0).toBe(100);
  });

  test('previewFormContext matches finish path for system totals', () => {
    const form = defaultForm();
    const fieldValues = { tyoryhma_kesto_pv: '5' };
    const lines = [{ product: materialProduct, quantity: 1 }];

    const preview = previewFormContext(form, fieldValues, lines, [], defaultSettings);
    const { context } = runFormCalculation({
      form,
      fieldValues,
      materialLines: lines,
      products: [],
      settings: defaultSettings,
    });

    expect(preview.kokonaishinta).toBeCloseTo(context.kokonaishinta, 2);
    expect(preview.materiaalit_alv0).toBeCloseTo(context.materiaalit_alv0, 2);
  });
});
