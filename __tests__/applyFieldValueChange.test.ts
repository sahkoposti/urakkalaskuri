import { previewFormContext } from '../src/core/calculation/calculationPipeline';
import { applyFieldValueChange, isComputedFieldOverridden, resetComputedFieldOverride } from '../src/core/form/applyFieldValueChange';
import { createMinimalFormDefinition } from '../src/core/form/defaultFormDefinition';
import { resolveFieldRawValue } from '../src/core/form/fieldDefaultValue';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import { computedFieldsAffectedByKeyChange } from '../src/core/form/formula/formulaDependencies';
import type { FormDefinition } from '../src/core/form/types';
import { defaultSettings } from '../src/core/models/types';

function defaultForm(): FormDefinition {
  return normalizeFormDefinition(createMinimalFormDefinition());
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

  test('clearing default-backed field keeps empty override instead of reverting', () => {
    const form = defaultForm();
    const surface = form.fields.find((field) => field.key === 'kiintea_seinapinta_ala_m2')!;
    surface.defaultValue = '120';

    const clearedFromDefault = applyFieldValueChange(form, {}, 'kiintea_seinapinta_ala_m2', '');
    expect(clearedFromDefault.kiintea_seinapinta_ala_m2).toBe('');
    expect(resolveFieldRawValue(surface, clearedFromDefault)).toBe('');

    const edited = applyFieldValueChange(form, {}, 'kiintea_seinapinta_ala_m2', '90');
    const clearedAfterEdit = applyFieldValueChange(form, edited, 'kiintea_seinapinta_ala_m2', '');
    expect(clearedAfterEdit.kiintea_seinapinta_ala_m2).toBe('');
    expect(resolveFieldRawValue(surface, clearedAfterEdit)).toBe('');
  });

  test('editing VAT-inclusive total clears a VAT0 override and vice versa', () => {
    const form = defaultForm();
    const withVat0 = applyFieldValueChange(form, baseValues, 'kokonaishinta_alv0', '1800');
    expect(withVat0.kokonaishinta_alv0).toBe('1800');

    const withVatIncl = applyFieldValueChange(form, withVat0, 'kokonaishinta', '1255');
    expect(withVatIncl.kokonaishinta).toBe('1255');
    expect(withVatIncl.kokonaishinta_alv0).toBeUndefined();

    const backToVat0 = applyFieldValueChange(form, withVatIncl, 'kokonaishinta_alv0', '2000');
    expect(backToVat0.kokonaishinta_alv0).toBe('2000');
    expect(backToVat0.kokonaishinta).toBeUndefined();
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
