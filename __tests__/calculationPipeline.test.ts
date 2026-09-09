import {
  CalculationValidationError,
  previewFormContext,
  runFormCalculation,
  runProductionPipeline,
} from '../src/core/calculation/calculationPipeline';
import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import { buildDebugFieldValues, runDebugPipeline } from '../src/core/form/pipeline';
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
  attributes: { consumption: 8, work_factor: 1 },
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
    expect(context.materiaalit).toBe(250);
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
    expect(context['kautettavamaali.tyokerroin']).toBe(1);
    expect(context['kautettavamaali.work_factor']).toBe(1);
  });

  test('work_factor 1 is not overwritten by leftover tyokerroin 1.25', () => {
    const form = defaultForm();
    form.fields.push({
      id: 'field_paint',
      key: 'kaytettava_maali',
      label: 'Maali',
      type: 'product_select',
      required: false,
      showOnSummary: true,
    });
    form.fields.push({
      id: 'field_hours',
      key: 'maalaus_h',
      label: 'Maalaus',
      type: 'computed',
      required: false,
      showOnSummary: true,
      formula: '10 * kaytettava_maali.tyokerroin',
    });

    const context = runProductionPipeline(
      form,
      { kaytettava_maali: 'paint-1', tyoryhma_kesto_pv: '5' },
      0,
      defaultSettings,
      [
        {
          ...paintProduct,
          attributes: { consumption: 8, work_factor: 1, tyokerroin: 1.25 },
        },
      ],
    );

    expect(context['kaytettava_maali.tyokerroin']).toBe(1);
    expect(context.maalaus_h).toBe(10);
  });

  test('selected product without work_factor uses tyokerroin 1', () => {
    const form = defaultForm();
    form.fields.push({
      id: 'field_paint',
      key: 'kaytettava_maali',
      label: 'Maali',
      type: 'product_select',
      required: false,
      showOnSummary: true,
    });
    form.fields.push({
      id: 'field_hours',
      key: 'maalaus_h',
      label: 'Maalaus',
      type: 'computed',
      required: false,
      showOnSummary: true,
      formula: '10 * kaytettava_maali.tyokerroin',
    });

    const context = runProductionPipeline(
      form,
      { kaytettava_maali: 'paint-1', tyoryhma_kesto_pv: '5' },
      0,
      defaultSettings,
      [{ ...paintProduct, attributes: { consumption: 8 } }],
    );

    expect(context['kaytettava_maali.tyokerroin']).toBe(1);
    expect(context.maalaus_h).toBe(10);
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

  test('finnish product aliases compute paint price in context', () => {
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
    expect(result.materialsVat0).toBe(0);
  });

  test('literal material effect adds fixed euros at end of calculation', () => {
    const form = defaultForm();
    form.fields.push({
      id: 'field_extra_material',
      key: 'lisamaalaus',
      label: 'Lisämaalaus',
      type: 'boolean',
      required: false,
      showOnSummary: false,
      effects: [{ type: 'add_material_fixed', value: 50 }],
    });

    const { result } = runFormCalculation({
      form,
      fieldValues: {
        kiintea_seinapinta_ala_m2: '120',
        aukkovahennykset: '18',
        laudoitustyyppi: '1.15',
        tyoryhma_kesto_pv: '5',
      },
      materialLines: [],
      products: [],
      settings: defaultSettings,
    });

    expect(result.materialsVat0).toBeCloseTo(50, 2);
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
    expect(
      result.contractPriceVat0 + result.materialsVat0 + result.marginEur + result.commissionEur,
    ).toBeCloseTo(result.totalPriceVat, 2);
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
        ? { ...field, formula: 'urakka_hinta_alv0 + materiaalit' }
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

  test('debug pipeline agrees with wizard previewFormContext', () => {
    const form = defaultForm();
    const fieldValues = buildDebugFieldValues(form);
    const wizardContext = previewFormContext(form, fieldValues, [], [], defaultSettings);

    const debug = runDebugPipeline(form, 'kokonaishinta', {
      settings: defaultSettings,
    });

    expect(debug.errors).toHaveLength(0);
    expect(debug.context.kokonaishinta).toBeCloseTo(wizardContext.kokonaishinta, 2);
  });

  test('materialsVat0 comes from materiaalit pipeline variable', () => {
    const form = defaultForm();

    const { result, context } = runFormCalculation({
      form,
      fieldValues: { tyoryhma_kesto_pv: '5' },
      materialLines: [{ product: materialProduct, quantity: 1 }],
      products: [],
      settings: defaultSettings,
    });

    expect(context.materiaalit).toBe(250);
    expect(result.materialsVat0).toBe(250);
    expect(form.fields.some((field) => field.systemKey === 'materiaalit_alv0')).toBe(false);
    expect(form.fields.some((field) => field.key === 'materiaalit_alv0')).toBe(false);
  });

  test('previewFormContext stays correct without field effects', () => {
    const form = defaultForm();
    const fieldValues = {
      kiintea_seinapinta_ala_m2: '120',
      aukkovahennykset: '18',
      laudoitustyyppi: '1.15',
      tyoryhma_kesto_pv: '5',
    };
    const preview = previewFormContext(form, fieldValues, [], [], defaultSettings);
    const full = runProductionPipeline(form, fieldValues, 0, defaultSettings);
    expect(preview.laskenta_seinapinta_ala_m2).toBeCloseTo(full.laskenta_seinapinta_ala_m2, 5);
    expect(preview.kokonaishinta).toBeCloseTo(full.kokonaishinta, 5);
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
    expect(preview.materiaalit).toBeCloseTo(context.materiaalit, 2);
  });

  test('manual override in fieldValues wins until the override key is removed', () => {
    const form = defaultForm();
    const baseValues = {
      kiintea_seinapinta_ala_m2: '120',
      aukkovahennykset: '18',
      laudoitustyyppi: '1.15',
      tyoryhma_kesto_pv: '5',
    };

    const live = previewFormContext(form, baseValues, [], [], defaultSettings);
    expect(live.laskenta_seinapinta_ala_m2).toBeCloseTo(117.3, 2);

    const overridden = previewFormContext(
      form,
      { ...baseValues, laskenta_seinapinta_ala_m2: '200' },
      [],
      [],
      defaultSettings,
    );
    expect(overridden.laskenta_seinapinta_ala_m2).toBe(200);

    const cleared = previewFormContext(
      form,
      {
        kiintea_seinapinta_ala_m2: '200',
        aukkovahennykset: '18',
        laudoitustyyppi: '1.15',
        tyoryhma_kesto_pv: '5',
      },
      [],
      [],
      defaultSettings,
    );
    expect(cleared.laskenta_seinapinta_ala_m2).toBeCloseTo(209.3, 2);
  });
});
