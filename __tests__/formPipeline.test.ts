import { evaluateFormula } from '../src/core/form/formula/evaluator';
import { runDebugPipeline } from '../src/core/form/pipeline';
import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';

describe('evaluateFormula', () => {
  test('evaluates basic arithmetic', () => {
    expect(evaluateFormula('(120 - 18) * 1.15', {})).toBeCloseTo(117.3, 2);
  });

  test('uses context variables', () => {
    expect(
      evaluateFormula('kiinteä_seinäpinta_ala_m2 - aukkovähennykset', {
        kiinteä_seinäpinta_ala_m2: 120,
        aukkovähennykset: 18,
      }),
    ).toBe(102);
  });
});

describe('runDebugPipeline', () => {
  test('combines per-field debug examples through full chain', () => {
    const form = createDefaultFormDefinition();
    const trace = runDebugPipeline(form, 'laskenta_seinäpinta_ala_m2');

    expect(trace.errors).toHaveLength(0);
    expect(trace.context.laskenta_seinäpinta_ala_m2).toBeCloseTo(117.3, 2);
    expect(trace.steps.some((step) => step.fieldKey === 'laskenta_seinäpinta_ala_m2')).toBe(true);
  });

  test('reports missing debug example for required field', () => {
    const form = createDefaultFormDefinition();
    form.fields = form.fields.map((field) =>
      field.key === 'kiinteä_seinäpinta_ala_m2'
        ? { ...field, debugExampleValue: undefined }
        : field,
    );
    const trace = runDebugPipeline(form);

    expect(trace.errors.some((error) => error.includes('Kiinteä seinäpinta-ala'))).toBe(true);
  });

  test('filters unrelated steps when focus field is set', () => {
    const form = createDefaultFormDefinition();
    const trace = runDebugPipeline(form, 'laskenta_seinäpinta_ala_m2');

    expect(trace.steps.some((step) => step.fieldKey === 'työryhmän_kesto_pv')).toBe(false);
    expect(trace.steps.some((step) => step.fieldKey === 'kiinteä_seinäpinta_ala_m2')).toBe(true);
    expect(trace.steps.some((step) => step.fieldKey === 'laudoitustyyppi')).toBe(true);
    expect(trace.steps.some((step) => step.fieldKey === 'laskenta_seinäpinta_ala_m2')).toBe(true);
  });

  test('ignores missing debug on unrelated required fields when focused', () => {
    const form = createDefaultFormDefinition();
    form.fields = form.fields.map((field) =>
      field.key === 'työryhmän_kesto_pv' ? { ...field, debugExampleValue: undefined } : field,
    );
    const trace = runDebugPipeline(form, 'laskenta_seinäpinta_ala_m2');

    expect(trace.errors.some((error) => error.includes('Kesto'))).toBe(false);
    expect(trace.context.laskenta_seinäpinta_ala_m2).toBeCloseTo(117.3, 2);
  });
});
