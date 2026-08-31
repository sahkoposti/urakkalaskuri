import { evaluateFormula } from '../src/core/form/formula/evaluator';
import { previewFormContext } from '../src/core/calculation/calculationPipeline';
import { buildDebugFieldValues, runDebugPipeline } from '../src/core/form/pipeline';
import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition, pipelineFieldOrder } from '../src/core/form/formDefinitionHelpers';
import { defaultSettings } from '../src/core/models/types';

function defaultForm() {
  return normalizeFormDefinition(createDefaultFormDefinition());
}

describe('evaluateFormula', () => {
  test('evaluates basic arithmetic', () => {
    expect(evaluateFormula('(120 - 18) * 1.15', {})).toBeCloseTo(117.3, 2);
  });

  test('uses context variables', () => {
    expect(
      evaluateFormula('kiintea_seinapinta_ala_m2 - aukkovahennykset', {
        kiintea_seinapinta_ala_m2: 120,
        aukkovahennykset: 18,
      }),
    ).toBe(102);
  });

  test('supports min max round if sqrt and comparisons', () => {
    expect(evaluateFormula('min(10, 3, 7)', {})).toBe(3);
    expect(evaluateFormula('max(10, 3)', {})).toBe(10);
    expect(evaluateFormula('round(1.234, 2)', {})).toBeCloseTo(1.23, 5);
    expect(evaluateFormula('if(pinta_ala > 100, 1.1, 1)', { pinta_ala: 120 })).toBeCloseTo(1.1, 5);
    expect(evaluateFormula('if(kaytossa, 15, 0)', { kaytossa: 0 })).toBe(0);
    expect(evaluateFormula('sqrt(9)', {})).toBe(3);
    expect(evaluateFormula('sqrt(0.25)', {})).toBeCloseTo(0.5, 5);
  });

  test('evaluates the same formula twice from the token cache', () => {
    expect(evaluateFormula('sqrt(9) + min(1, 2)', {})).toBe(4);
    expect(evaluateFormula('sqrt(9) + min(1, 2)', {})).toBe(4);
  });

  test('missing identifiers and division by zero are 0', () => {
    expect(evaluateFormula('julkisivupinnat_valinta * 120', {})).toBe(0);
    expect(evaluateFormula('pinta / kaytettava_maali.menekki', { pinta: 100 })).toBe(0);
  });

  test('sqrt rejects a negative argument', () => {
    expect(() => evaluateFormula('sqrt(-1)', {})).toThrow('sqrt() ei salli negatiivista lukua');
  });
});

describe('runDebugPipeline', () => {
  test('combines per-field debug examples through full chain', () => {
    const form = defaultForm();
    const trace = runDebugPipeline(form, 'laskenta_seinapinta_ala_m2');

    expect(trace.errors).toHaveLength(0);
    expect(trace.context.laskenta_seinapinta_ala_m2).toBeCloseTo(117.3, 2);
    expect(trace.steps.some((step) => step.fieldKey === 'laskenta_seinapinta_ala_m2')).toBe(true);
  });

  test('reports missing debug example for required field', () => {
    const form = defaultForm();
    form.fields = form.fields.map((field) =>
      field.key === 'kiintea_seinapinta_ala_m2'
        ? { ...field, debugExampleValue: undefined }
        : field,
    );
    const trace = runDebugPipeline(form);

    expect(trace.errors.some((error) => error.includes('Kiinteä seinäpinta-ala'))).toBe(true);
  });

  test('filters unrelated steps when focus field is set', () => {
    const form = defaultForm();
    const trace = runDebugPipeline(form, 'laskenta_seinapinta_ala_m2');

    expect(trace.steps.some((step) => step.fieldKey === 'tyoryhma_kesto_pv')).toBe(false);
    expect(trace.steps.some((step) => step.fieldKey === 'kiintea_seinapinta_ala_m2')).toBe(true);
    expect(trace.steps.some((step) => step.fieldKey === 'laudoitustyyppi')).toBe(true);
    expect(trace.steps.some((step) => step.fieldKey === 'laskenta_seinapinta_ala_m2')).toBe(true);
  });

  test('ignores missing debug on unrelated required fields when focused', () => {
    const form = defaultForm();
    form.fields = form.fields.map((field) =>
      field.key === 'tyoryhma_kesto_pv' ? { ...field, debugExampleValue: undefined } : field,
    );
    const trace = runDebugPipeline(form, 'laskenta_seinapinta_ala_m2');

    expect(trace.errors.some((error) => error.includes('Kesto'))).toBe(false);
    expect(trace.context.laskenta_seinapinta_ala_m2).toBeCloseTo(117.3, 2);
  });

  test('evaluates system fields with settings context', () => {
    const form = defaultForm();
    const trace = runDebugPipeline(form, 'kokonaishinta', {
      settings: defaultSettings,
    });

    expect(trace.errors).toHaveLength(0);
    expect(trace.context.tyoryhma_kesto_h).toBeCloseTo(40, 2);
    expect(trace.context.urakka_hinta_alv0).toBeCloseTo(2400, 2);
    expect(trace.context.materiaalit).toBe(0);
    expect(trace.context.kokonaishinta).toBeGreaterThan(0);
  });

  test('orders kokonaishinta before alv_maara dependencies', () => {
    const form = defaultForm();
    const order = pipelineFieldOrder(form).map((field) => field.key);
    const kokonaishinta = order.indexOf('kokonaishinta');
    const kokonaishintaAlv0 = order.indexOf('kokonaishinta_alv0');
    const alvMaara = order.indexOf('alv_maara');

    expect(kokonaishinta).toBeGreaterThan(-1);
    expect(kokonaishintaAlv0).toBeGreaterThan(kokonaishinta);
    expect(alvMaara).toBeGreaterThan(kokonaishintaAlv0);
  });

  test('evaluates alv_maara after kokonaishinta chain', () => {
    const form = defaultForm();
    const trace = runDebugPipeline(form, 'alv_maara', {
      settings: defaultSettings,
    });

    expect(trace.errors).toHaveLength(0);
    expect(trace.context.kokonaishinta).toBeGreaterThan(0);
    expect(trace.context.kokonaishinta_alv0).toBeGreaterThan(0);
    expect(trace.context.alv_maara).toBeGreaterThan(0);
  });

  test('alv_maara reports missing upstream deps instead of unknown kokonaishinta', () => {
    const form = defaultForm();
    form.fields = form.fields.map((field) =>
      field.key === 'tyoryhma_kesto_pv' ? { ...field, debugExampleValue: undefined } : field,
    );
    const trace = runDebugPipeline(form, 'alv_maara', {
      settings: defaultSettings,
    });

    expect(trace.errors.some((error) => error.includes('Odottaa laskettuja kenttiä'))).toBe(true);
    expect(trace.errors.some((error) => error.includes('Tuntematon muuttuja: kokonaishinta'))).toBe(
      false,
    );
  });

  test('system formulas use Finnish setting variables', () => {
    const form = defaultForm();
    const tyoryhma = form.fields.find((field) => field.systemKey === 'tyoryhma_kesto_h');
    expect(tyoryhma?.formula).toContain('asetukset.tyopaivan_pituus');
    expect(tyoryhma?.formula).not.toContain('settings.');
  });

  test('debug pipeline exports product list attributes from example product', () => {
    const form = defaultForm();
    form.fields.push({
      id: 'field_paint',
      key: 'kaytettava_maali',
      label: 'Käytettävä maali',
      type: 'product_select',
      required: true,
      showOnSummary: true,
      debugExampleValue: 'paint-1',
    });
    form.fields.push({
      id: 'field_paint_amount',
      key: 'materiaali_maara',
      label: 'Maalimäärä',
      type: 'computed',
      required: false,
      showOnSummary: true,
      formula: 'laskenta_seinapinta_ala_m2 / kaytettava_maali.menekki',
    });

    const paint = {
      id: 'paint-1',
      name: 'Maali',
      unit: 'l',
      unitPriceVat0: 12,
      attributes: { consumption: 8 },
      createdAt: new Date(),
    };

    const trace = runDebugPipeline(form, 'materiaali_maara', {
      settings: defaultSettings,
      products: [paint],
    });

    expect(trace.errors).toHaveLength(0);
    expect(trace.context['kaytettava_maali.unit_price']).toBe(12);
    expect(trace.context['kaytettava_maali.yksikkohinta']).toBe(12);
    expect(trace.context['kaytettava_maali.consumption']).toBe(8);
    expect(trace.context['kaytettava_maali.menekki']).toBe(8);
    expect(trace.context.materiaali_maara).toBeCloseTo(117.3 / 8, 2);
  });

  test('computes materiaalit from debug product and add_material_fixed effect', () => {
    const form = defaultForm();
    form.fields.push({
      id: 'field_paint',
      key: 'kaytettava_maali',
      label: 'Käytettävä maali',
      type: 'product_select',
      required: true,
      showOnSummary: true,
      debugExampleValue: 'paint-1',
    });
    form.fields.push({
      id: 'field_paint_cost',
      key: 'maalin_kustannus',
      label: 'Maalin kustannus',
      type: 'computed',
      required: false,
      showOnSummary: true,
      unit: '€',
      formula: 'laskenta_seinapinta_ala_m2 / kaytettava_maali.menekki * kaytettava_maali.yksikkohinta',
      effects: [{ type: 'add_material_fixed' }],
    });

    const paint = {
      id: 'paint-1',
      name: 'Maali',
      unit: 'l',
      unitPriceVat0: 12,
      attributes: { consumption: 8 },
      createdAt: new Date(),
    };

    const trace = runDebugPipeline(form, 'kokonaishinta', {
      settings: defaultSettings,
      products: [paint],
    });

    const expectedMaterials = (117.3 / 8) * 12;
    expect(trace.errors).toHaveLength(0);
    expect(trace.context.maalin_kustannus).toBeCloseTo(expectedMaterials, 2);
    expect(trace.context.materiaalit).toBeCloseTo(expectedMaterials, 2);
    expect(trace.context.kokonaishinta).toBeGreaterThan(0);
  });

  test('debug context matches wizard previewFormContext with debug field values', () => {
    const form = defaultForm();
    form.fields.push({
      id: 'field_paint',
      key: 'kaytettava_maali',
      label: 'Käytettävä maali',
      type: 'product_select',
      required: true,
      showOnSummary: true,
      debugExampleValue: 'paint-1',
    });
    form.fields.push({
      id: 'field_paint_cost',
      key: 'maalin_kustannus',
      label: 'Maalin kustannus',
      type: 'computed',
      required: false,
      showOnSummary: true,
      unit: '€',
      formula: 'laskenta_seinapinta_ala_m2 / kaytettava_maali.menekki * kaytettava_maali.yksikkohinta',
      effects: [{ type: 'add_material_fixed' }],
    });

    const paint = {
      id: 'paint-1',
      name: 'Maali',
      unit: 'l',
      unitPriceVat0: 12,
      attributes: { consumption: 8 },
      createdAt: new Date(),
    };
    const products = [paint];
    const fieldValues = buildDebugFieldValues(form);
    const wizardContext = previewFormContext(form, fieldValues, [], products, defaultSettings);
    const trace = runDebugPipeline(form, undefined, { settings: defaultSettings, products });

    for (const [key, value] of Object.entries(wizardContext)) {
      expect(trace.context[key]).toBeCloseTo(value, 5);
    }
  });
});
