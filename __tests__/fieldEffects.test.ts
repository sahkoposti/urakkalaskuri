import {
  applyDurationEffects,
  applyFieldEffects,
  applyMaterialEffects,
} from '@/src/core/form/fieldEffects';
import type { FormDefinition, FormField } from '@/src/core/form/types';

function minimalForm(fields: FormField[]): FormDefinition {
  return {
    id: 'test-form',
    name: 'Test',
    version: 1,
    pages: [{ id: 'p1', title: 'Sivu', sortOrder: 0, fieldIds: fields.map((f) => f.id) }],
    fields,
    updatedAt: 0,
  };
}

describe('fieldEffects', () => {
  test('add_material_fixed with literal value adds euros', () => {
    const form = minimalForm([
      {
        id: 'f1',
        key: 'lisamateriaali',
        label: 'Lisämateriaali',
        type: 'boolean',
        required: false,
        showOnSummary: false,
        effects: [{ type: 'add_material_fixed', value: 15 }],
      },
    ]);

    const result = applyFieldEffects(form, {});
    expect(applyMaterialEffects(100, result)).toBe(115);
  });

  test('multiply_materials with literal factor scales materials', () => {
    const form = minimalForm([
      {
        id: 'f1',
        key: 'kerroin',
        label: 'Kerroin',
        type: 'number',
        required: false,
        showOnSummary: false,
        effects: [{ type: 'multiply_materials', value: 1.1 }],
      },
    ]);

    const result = applyFieldEffects(form, {});
    expect(applyMaterialEffects(200, result)).toBeCloseTo(220, 5);
  });

  test('multiply_duration with literal factor scales hours', () => {
    const form = minimalForm([
      {
        id: 'f1',
        key: 'kestokerroin',
        label: 'Kestokerroin',
        type: 'number',
        required: false,
        showOnSummary: false,
        effects: [{ type: 'multiply_duration', value: 1.1 }],
      },
    ]);

    const result = applyFieldEffects(form, {});
    expect(applyDurationEffects(40, result)).toBeCloseTo(44, 5);
  });

  test('add_duration with literal value adds hours', () => {
    const form = minimalForm([
      {
        id: 'f1',
        key: 'lisatunnit',
        label: 'Lisätunnit',
        type: 'number',
        required: false,
        showOnSummary: false,
        effects: [{ type: 'add_duration', value: 3 }],
      },
    ]);

    const result = applyFieldEffects(form, {});
    expect(applyDurationEffects(40, result)).toBe(43);
  });

  test('add_material_fixed without value uses the field key from context', () => {
    const form = minimalForm([
      {
        id: 'f1',
        key: 'maali_hinta',
        label: 'Maalihinta',
        type: 'computed',
        required: false,
        showOnSummary: true,
        effects: [{ type: 'add_material_fixed' }],
      },
    ]);

    const result = applyFieldEffects(form, { maali_hinta: 175.95 });
    expect(applyMaterialEffects(0, result)).toBeCloseTo(175.95, 2);
  });

  test('legacy quantityRef still resolves from context when value is missing', () => {
    const form = minimalForm([
      {
        id: 'f1',
        key: 'maali_hinta',
        label: 'Maalihinta',
        type: 'computed',
        required: false,
        showOnSummary: true,
        effects: [{ type: 'add_material_fixed', quantityRef: 'maali_hinta' }],
      },
    ]);

    const result = applyFieldEffects(form, { maali_hinta: 175.95 });
    expect(applyMaterialEffects(0, result)).toBeCloseTo(175.95, 2);
  });

  test('prefers literal value over legacy quantityRef', () => {
    const form = minimalForm([
      {
        id: 'f1',
        key: 'maali_hinta',
        label: 'Maalihinta',
        type: 'computed',
        required: false,
        showOnSummary: true,
        effects: [{ type: 'add_material_fixed', value: 50, quantityRef: 'maali_hinta' }],
      },
    ]);

    const result = applyFieldEffects(form, { maali_hinta: 175.95 });
    expect(applyMaterialEffects(0, result)).toBe(50);
  });

  test('ignores effects when field is hidden by showWhen', () => {
    const form = minimalForm([
      {
        id: 'f_gate',
        key: 'kaytossa',
        label: 'Käytössä',
        type: 'boolean',
        required: false,
        showOnSummary: false,
      },
      {
        id: 'f1',
        key: 'lisamateriaali',
        label: 'Lisämateriaali',
        type: 'number',
        required: false,
        showOnSummary: false,
        showWhen: { fieldKey: 'kaytossa', value: 'true' },
        effects: [{ type: 'add_material_fixed', value: 15 }],
      },
    ]);

    const hidden = applyFieldEffects(form, {}, { kaytossa: 'false' });
    expect(applyMaterialEffects(100, hidden)).toBe(100);

    const shown = applyFieldEffects(form, {}, { kaytossa: 'true' });
    expect(applyMaterialEffects(100, shown)).toBe(115);
  });
});
