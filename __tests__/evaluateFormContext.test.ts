import { evaluateFormContext } from '../src/core/form/evaluateFormContext';
import type { FormDefinition, FormField } from '../src/core/form/types';
import { defaultSettings } from '../src/core/models/types';

function field(partial: Partial<FormField> & Pick<FormField, 'id' | 'key' | 'label' | 'type'>): FormField {
  return {
    required: false,
    showOnSummary: true,
    ...partial,
  };
}

function shadeForm(): FormDefinition {
  const savyjenLkm = field({
    id: 'field_savyjen_lkm',
    key: 'savyjen_lkm',
    label: 'Sävyjen lukumäärä',
    type: 'number',
    required: true,
  });
  const perusMenekki = field({
    id: 'field_perus_menekki',
    key: 'ensimmainen_savy_menekki',
    label: 'Seinäpintojen maalimenekki',
    type: 'number',
    required: true,
  });
  const kolmasMenekki = field({
    id: 'field_kolmas_menekki',
    key: 'kolmas_savy_menekki',
    label: 'Kolmannen sävyn lisämenekki',
    type: 'number',
    required: true,
    showWhen: { fieldKey: 'savyjen_lkm', operator: 'gt', value: '2' },
    debugExampleValue: '3',
  });
  const yhteensa = field({
    id: 'field_yhteensa',
    key: 'maalit_yhteensa_litraa',
    label: 'Maalit yhteensä',
    type: 'computed',
    formula: 'ensimmainen_savy_menekki + if(savyjen_lkm > 2, kolmas_savy_menekki, 0)',
  });
  const suorassa = field({
    id: 'field_suorassa',
    key: 'menekki_ilman_if',
    label: 'Menekki ilman if',
    type: 'computed',
    formula: 'ensimmainen_savy_menekki + kolmas_savy_menekki',
  });

  return {
    id: 'form_shades',
    name: 'Sävyt',
    version: 1,
    updatedAt: 0,
    pages: [
      {
        id: 'page_1',
        title: 'Maalit',
        sortOrder: 0,
        fieldIds: [savyjenLkm.id, perusMenekki.id, kolmasMenekki.id, yhteensa.id, suorassa.id],
      },
    ],
    fields: [savyjenLkm, perusMenekki, kolmasMenekki, yhteensa, suorassa],
  };
}

describe('evaluateFormContext hidden number fields', () => {
  test('hidden number is 0 even if a leftover value is stored', () => {
    const { context, errors } = evaluateFormContext({
      form: shadeForm(),
      settings: defaultSettings,
      materialsTotal: 0,
      fieldValues: {
        savyjen_lkm: '2',
        ensimmainen_savy_menekki: '10',
        kolmas_savy_menekki: '3',
      },
      collectTrace: true,
    });

    expect(errors).toHaveLength(0);
    expect(context.kolmas_savy_menekki).toBe(0);
    expect(context.maalit_yhteensa_litraa).toBe(10);
    expect(context.menekki_ilman_if).toBe(10);
  });

  test('visible number uses the entered value', () => {
    const { context, errors } = evaluateFormContext({
      form: shadeForm(),
      settings: defaultSettings,
      materialsTotal: 0,
      fieldValues: {
        savyjen_lkm: '3',
        ensimmainen_savy_menekki: '10',
        kolmas_savy_menekki: '3',
      },
      collectTrace: true,
    });

    expect(errors).toHaveLength(0);
    expect(context.kolmas_savy_menekki).toBe(3);
    expect(context.maalit_yhteensa_litraa).toBe(13);
    expect(context.menekki_ilman_if).toBe(13);
  });

  test('debug examples also treat a hidden number as 0', () => {
    const form = shadeForm();
    form.fields = form.fields.map((item) => {
      if (item.key === 'savyjen_lkm') return { ...item, debugExampleValue: '2' };
      if (item.key === 'ensimmainen_savy_menekki') return { ...item, debugExampleValue: '10' };
      return item;
    });

    const { context, errors } = evaluateFormContext({
      form,
      settings: defaultSettings,
      materialsTotal: 0,
      useDebugExamples: true,
      collectTrace: true,
    });

    expect(errors).toHaveLength(0);
    expect(context.kolmas_savy_menekki).toBe(0);
    expect(context.maalit_yhteensa_litraa).toBe(10);
  });

  test('hidden select is still omitted from context', () => {
    const extra = field({
      id: 'field_extra',
      key: 'lisavalinta',
      label: 'Lisävalinta',
      type: 'select',
      options: [{ label: 'Kyllä', value: '1.5' }],
      showWhen: { fieldKey: 'savyjen_lkm', operator: 'gt', value: '2' },
    });
    const form = shadeForm();
    form.fields.push(extra);
    form.pages[0].fieldIds.push(extra.id);

    const { context } = evaluateFormContext({
      form,
      settings: defaultSettings,
      materialsTotal: 0,
      fieldValues: {
        savyjen_lkm: '1',
        ensimmainen_savy_menekki: '10',
        lisavalinta: '1.5',
      },
    });

    expect(context.lisavalinta).toBeUndefined();
  });

  test('boolean showWhen value true does not crash preview', () => {
    const toggle = field({
      id: 'f_toggle',
      key: 'julkisivupinnat_valinta',
      label: 'Julkisivu',
      type: 'boolean',
    });
    const area = field({
      id: 'f_area',
      key: 'kiintea_seinapinta_ala_m2',
      label: 'Pinta',
      type: 'number',
      showWhen: {
        fieldKey: 'julkisivupinnat_valinta',
        operator: 'eq',
        value: true as unknown as string,
      },
    });
    const form: FormDefinition = {
      id: 'crash',
      name: 'Crash',
      version: 1,
      updatedAt: 0,
      pages: [{ id: 'p1', title: 'Sivu', sortOrder: 0, fieldIds: [toggle.id, area.id] }],
      fields: [toggle, area],
    };

    expect(() =>
      evaluateFormContext({
        form,
        settings: defaultSettings,
        materialsTotal: 0,
        fieldValues: {},
      }),
    ).not.toThrow();
  });
});
