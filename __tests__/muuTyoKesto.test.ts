import { runFormCalculation } from '../src/core/calculation/calculationPipeline';
import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition, unknownFormulaIdentifiers } from '../src/core/form/formDefinitionHelpers';
import { buildDebugFieldValues } from '../src/core/form/pipeline';
import { migrateFormulaKeys } from '../src/core/form/systemFields';
import type { Product } from '../src/core/models/types';
import { defaultSettings } from '../src/core/models/types';

const paint: Product = {
  id: '15a3a629-b764-4e10-bf5e-3ce5e298c1e2',
  name: 'Ulkomaali',
  unit: 'l',
  unitPriceVat0: 8,
  attributes: { consumption: 8, work_factor: 1 },
  createdAt: new Date('2026-01-01'),
};

function defaultForm() {
  return normalizeFormDefinition(createDefaultFormDefinition());
}

describe('muun työn kesto henkilötunteina', () => {
  test('default form uses Muun työn kesto (h) without työpari', () => {
    const form = defaultForm();
    expect(form.version).toBe(109);
    expect(form.fields.some((field) => field.key === 'muu_tyo_tyoparin_kesto_h')).toBe(false);

    const field = form.fields.find((item) => item.key === 'muu_tyo_kesto_h');
    expect(field?.label).toBe('Muun työn kesto');
    expect(field?.unit).toBe('h');
    expect(field?.id).toBe('field_muu_tyo_kesto');

    const workPhases = form.pages.find((page) => page.id === 'page_work_phases');
    expect(workPhases?.fieldIds).toContain('field_muu_tyo_kesto');
    expect(workPhases?.fieldIds).not.toContain('field_muu_tyo_tyoparin_kesto');

    const paatuote = form.fields.find((item) => item.key === 'paatuote_tyo_h');
    expect(paatuote?.formula).toContain('muu_tyo_kesto_h');
    expect(paatuote?.formula).not.toContain('muu_tyo_tyoparin_kesto_h');
    expect(paatuote?.formula).not.toContain('muu_tyo_kesto_h * 2');
    expect(unknownFormulaIdentifiers(form, paatuote?.formula ?? '')).toEqual([]);
  });

  test('adds person-hours as-is, not × 2 työpari', () => {
    const form = defaultForm();
    const base = { ...buildDebugFieldValues(form), henkilonostin_valinta: 'false' };

    const none = runFormCalculation({
      form,
      fieldValues: { ...base, muu_tyo_kesto_h: '0' },
      materialLines: [],
      products: [paint],
      settings: defaultSettings,
    });
    const three = runFormCalculation({
      form,
      fieldValues: { ...base, muu_tyo_kesto_h: '3' },
      materialLines: [],
      products: [paint],
      settings: defaultSettings,
    });

    expect(three.context.paatuote_tyo_h - none.context.paatuote_tyo_h).toBeCloseTo(3, 5);
    expect(three.context.henkilotyotunnit - none.context.henkilotyotunnit).toBeCloseTo(3, 5);
  });

  test('legacy tyoparin key still feeds the new field', () => {
    const form = defaultForm();
    const base = { ...buildDebugFieldValues(form), henkilonostin_valinta: 'false' };
    const none = runFormCalculation({
      form,
      fieldValues: { ...base, muu_tyo_kesto_h: '0' },
      materialLines: [],
      products: [paint],
      settings: defaultSettings,
    });
    const fieldValues: Record<string, string> = { ...base };
    delete fieldValues.muu_tyo_kesto_h;
    const legacy = runFormCalculation({
      form,
      fieldValues: { ...fieldValues, muu_tyo_tyoparin_kesto_h: '2' },
      materialLines: [],
      products: [paint],
      settings: defaultSettings,
    });
    expect(legacy.context.henkilotyotunnit - none.context.henkilotyotunnit).toBeCloseTo(2, 5);
  });

  test('migrateFormulaKeys drops työpari × 2', () => {
    expect(
      migrateFormulaKeys(
        'pinta + if(muu_tyo_tyoparin_kesto_h > 0, muu_tyo_tyoparin_kesto_h * 2, 0) + 1',
      ),
    ).toBe('pinta + muu_tyo_kesto_h + 1');
  });

  test('normalize remaps an old among-work field', () => {
    const form = normalizeFormDefinition({
      id: 'julkisivumaalaus',
      name: 'Julkisivumaalaus',
      version: 107,
      pages: [{ id: 'page_surfaces', title: 'Pinta', sortOrder: 0, fieldIds: ['field_muu_tyo_tyoparin_kesto'] }],
      fields: [
        {
          id: 'field_muu_tyo_tyoparin_kesto',
          key: 'muu_tyo_tyoparin_kesto_h',
          label: 'Muun työn kesto',
          type: 'number',
          required: false,
          showOnSummary: true,
          showOnSummaryWhen: {
            fieldKey: 'muu_tyo_tyoparin_kesto_h',
            operator: 'gt',
            value: '0',
          },
          unit: 'h (työpari)',
        },
        {
          id: 'field_paatuote_tyo_h',
          key: 'paatuote_tyo_h',
          label: 'Päätuotteen työ',
          type: 'computed',
          required: false,
          showOnSummary: true,
          formula: 'if(muu_tyo_tyoparin_kesto_h > 0, muu_tyo_tyoparin_kesto_h * 2, 0)',
        },
      ],
      updatedAt: 0,
    });
    const field = form.fields.find((item) => item.id === 'field_muu_tyo_tyoparin_kesto');
    expect(field?.key).toBe('muu_tyo_kesto_h');
    expect(field?.showOnSummaryWhen?.fieldKey).toBe('muu_tyo_kesto_h');
    const paatuote = form.fields.find((item) => item.key === 'paatuote_tyo_h');
    expect(paatuote?.formula).toBe('muu_tyo_kesto_h');
  });
});
