import { evaluateFormula } from '../src/core/form/formula/evaluator';
import { runDebugPipeline } from '../src/core/form/pipeline';
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
      materialsVat0: 250,
    });

    expect(trace.errors).toHaveLength(0);
    expect(trace.context.tyoryhma_kesto_h).toBeCloseTo(40, 2);
    expect(trace.context.urakka_hinta_alv0).toBeCloseTo(2400, 2);
    expect(trace.context.materiaalit_alv0).toBe(250);
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
      materialsVat0: 250,
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
      materialsVat0: 250,
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
});
