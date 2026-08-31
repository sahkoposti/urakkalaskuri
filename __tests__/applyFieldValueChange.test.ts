import { previewFormContext } from '../src/core/calculation/calculationPipeline';
import { applyFieldValueChange, isComputedFieldOverridden, resetComputedFieldOverride } from '../src/core/form/applyFieldValueChange';
import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import { computedFieldsAffectedByKeyChange } from '../src/core/form/formula/formulaDependencies';
import type { FormDefinition } from '../src/core/form/types';
import { defaultSettings } from '../src/core/models/types';

function defaultForm(): FormDefinition {
  return normalizeFormDefinition(createDefaultFormDefinition());
}

const baseValues = {
  kiintea_seinapinta_ala_m2: '120',
  aukkovahennykset: '18',
  laudoitustyyppi: '1.15',
  tyoryhma_kesto_pv: '5',
};

describe('applyFieldValueChange', () => {
  test('keeps manual computed value until a formula input changes', () => {
    const form = defaultForm();
    const overridden = applyFieldValueChange(
      form,
      baseValues,
      'laskenta_seinapinta_ala_m2',
      '200',
    );
    expect(overridden.laskenta_seinapinta_ala_m2).toBe('200');

    const stillManual = previewFormContext(form, overridden, [], [], defaultSettings);
    expect(stillManual.laskenta_seinapinta_ala_m2).toBe(200);
  });

  test('clears computed override when a formula input changes and recalculates live', () => {
    const form = defaultForm();
    const overridden = applyFieldValueChange(
      form,
      baseValues,
      'laskenta_seinapinta_ala_m2',
      '200',
    );

    const afterInput = applyFieldValueChange(form, overridden, 'kiintea_seinapinta_ala_m2', '200');
    expect(afterInput.laskenta_seinapinta_ala_m2).toBeUndefined();
    expect(afterInput.kiintea_seinapinta_ala_m2).toBe('200');

    const live = previewFormContext(form, afterInput, [], [], defaultSettings);
    expect(live.laskenta_seinapinta_ala_m2).toBeCloseTo(209.3, 2);
  });

  test('clears nested computed overrides when an upstream input changes', () => {
    const form = defaultForm();
    const duration = form.fields.find((field) => field.key === 'tyoryhma_kesto_pv')!;
    duration.formula = 'laskenta_seinapinta_ala_m2 / 25';

    const withOverrides = {
      ...baseValues,
      laskenta_seinapinta_ala_m2: '200',
      tyoryhma_kesto_pv: '9',
    };

    const next = applyFieldValueChange(form, withOverrides, 'aukkovahennykset', '10');
    expect(next.laskenta_seinapinta_ala_m2).toBeUndefined();
    expect(next.tyoryhma_kesto_pv).toBeUndefined();
    expect(next.aukkovahennykset).toBe('10');

    const live = previewFormContext(form, next, [], [], defaultSettings);
    expect(live.laskenta_seinapinta_ala_m2).toBeCloseTo((120 - 10) * 1.15, 2);
    expect(live.tyoryhma_kesto_pv).toBeCloseTo(live.laskenta_seinapinta_ala_m2 / 25, 5);
  });

  test('clears product-formula computed override when the product field changes', () => {
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
      id: 'field_paint_cost',
      key: 'maalin_hinta',
      label: 'Maalin hinta',
      type: 'computed',
      required: false,
      showOnSummary: true,
      allowManualOverride: true,
      formula: 'laskenta_seinapinta_ala_m2 / kaytettava_maali.menekki * kaytettava_maali.yksikkohinta',
    });

    const prev = {
      ...baseValues,
      kaytettava_maali: 'paint-1',
      maalin_hinta: '999',
    };
    const next = applyFieldValueChange(form, prev, 'kaytettava_maali', 'paint-2');
    expect(next.kaytettava_maali).toBe('paint-2');
    expect(next.maalin_hinta).toBeUndefined();
  });

  test('editing a computed field does not clear its own override', () => {
    const form = defaultForm();
    const next = applyFieldValueChange(form, baseValues, 'laskenta_seinapinta_ala_m2', '150');
    expect(next.laskenta_seinapinta_ala_m2).toBe('150');
    expect(next.kiintea_seinapinta_ala_m2).toBe('120');
  });

  test('clearing a computed field keeps manual override mode with empty value', () => {
    const form = defaultForm();
    const overridden = applyFieldValueChange(
      form,
      baseValues,
      'laskenta_seinapinta_ala_m2',
      '200',
    );
    const cleared = applyFieldValueChange(form, overridden, 'laskenta_seinapinta_ala_m2', '');
    expect(cleared.laskenta_seinapinta_ala_m2).toBe('');
    expect(isComputedFieldOverridden(form, cleared, 'laskenta_seinapinta_ala_m2')).toBe(true);
  });

  test('clearing computed display without prior override enters manual mode', () => {
    const form = defaultForm();
    const cleared = applyFieldValueChange(form, baseValues, 'laskenta_seinapinta_ala_m2', '');
    expect(cleared.laskenta_seinapinta_ala_m2).toBe('');
    expect(isComputedFieldOverridden(form, cleared, 'laskenta_seinapinta_ala_m2')).toBe(true);
  });

  test('resetComputedFieldOverride removes manual override', () => {
    const form = defaultForm();
    const overridden = applyFieldValueChange(
      form,
      baseValues,
      'laskenta_seinapinta_ala_m2',
      '200',
    );
    const reset = resetComputedFieldOverride(overridden, 'laskenta_seinapinta_ala_m2');
    expect(reset.laskenta_seinapinta_ala_m2).toBeUndefined();
    expect(isComputedFieldOverridden(form, reset, 'laskenta_seinapinta_ala_m2')).toBe(false);
  });
});

describe('computedFieldsAffectedByKeyChange', () => {
  test('includes direct and transitive computed dependents', () => {
    const form = defaultForm();
    const duration = form.fields.find((field) => field.key === 'tyoryhma_kesto_pv')!;
    duration.formula = 'laskenta_seinapinta_ala_m2 / 25';

    const affected = computedFieldsAffectedByKeyChange(form, 'kiintea_seinapinta_ala_m2');
    expect(affected).toEqual(expect.arrayContaining(['laskenta_seinapinta_ala_m2', 'tyoryhma_kesto_pv']));
  });
});
