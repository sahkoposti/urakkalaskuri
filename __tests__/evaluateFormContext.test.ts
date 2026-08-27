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

  test('hidden select is 0 in context', () => {
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

    expect(context.lisavalinta).toBe(0);
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

describe('evaluateFormContext live defaults', () => {
  test('empty boolean is 0 so formulas do not throw', () => {
    const toggle = field({
      id: 'f_toggle',
      key: 'julkisivupinnat_valinta',
      label: 'Julkisivu',
      type: 'boolean',
    });
    const area = field({
      id: 'f_area',
      key: 'laskenta',
      label: 'Laskenta',
      type: 'computed',
      formula: 'julkisivupinnat_valinta * 120',
    });
    const form: FormDefinition = {
      id: 'live',
      name: 'Live',
      version: 1,
      updatedAt: 0,
      pages: [{ id: 'p1', title: 'Sivu', sortOrder: 0, fieldIds: [toggle.id, area.id] }],
      fields: [toggle, area],
    };

    const { context, errors } = evaluateFormContext({
      form,
      settings: defaultSettings,
      materialsTotal: 0,
      fieldValues: {},
      collectTrace: true,
    });

    expect(errors).toHaveLength(0);
    expect(context.julkisivupinnat_valinta).toBe(0);
    expect(context.laskenta).toBe(0);
  });

  test('select defaultValue is used when the user has not chosen yet', () => {
    const terrain = field({
      id: 'f_terrain',
      key: 'maaston_vaikeusaste',
      label: 'Maasto',
      type: 'select',
      defaultValue: '1.1',
      options: [
        { label: 'Tasainen', value: '1' },
        { label: 'Rinne', value: '1.1' },
      ],
    });
    const hours = field({
      id: 'f_hours',
      key: 'tyo_h',
      label: 'Työ',
      type: 'computed',
      formula: '10 * maaston_vaikeusaste',
    });
    const form: FormDefinition = {
      id: 'defaults',
      name: 'Defaults',
      version: 1,
      updatedAt: 0,
      pages: [{ id: 'p1', title: 'Sivu', sortOrder: 0, fieldIds: [terrain.id, hours.id] }],
      fields: [terrain, hours],
    };

    const { context } = evaluateFormContext({
      form,
      settings: defaultSettings,
      materialsTotal: 0,
      fieldValues: {},
    });

    expect(context.maaston_vaikeusaste).toBeCloseTo(1.1);
    expect(context.tyo_h).toBeCloseTo(11);
  });

  test('computed showWhen reveals number fields on the second pass', () => {
    const facade = field({
      id: 'f_facade',
      key: 'julkisivupinnat_valinta',
      label: 'Julkisivu',
      type: 'boolean',
    });
    const trim = field({
      id: 'f_trim',
      key: 'pieluslaudat_valinta',
      label: 'Pieluslaudat',
      type: 'boolean',
    });
    const needed = field({
      id: 'f_needed',
      key: 'ikkunat_ovet_tarvitaan',
      label: 'Ikkuna- ja ovitiedot tarvitaan',
      type: 'computed',
      formula: 'max(julkisivupinnat_valinta, pieluslaudat_valinta)',
    });
    const windows = field({
      id: 'f_windows',
      key: 'ikkunat_lkm',
      label: 'Ikkunat',
      type: 'number',
      required: true,
      showWhen: { fieldKey: 'ikkunat_ovet_tarvitaan', operator: 'eq', value: '1' },
    });
    const openings = field({
      id: 'f_openings',
      key: 'aukkovahennykset',
      label: 'Aukot',
      type: 'computed',
      formula: 'ikkunat_lkm * 1.5',
    });
    const form: FormDefinition = {
      id: 'showwhen-computed',
      name: 'ShowWhen',
      version: 1,
      updatedAt: 0,
      pages: [
        {
          id: 'p1',
          title: 'Sivu',
          sortOrder: 0,
          fieldIds: [facade.id, trim.id, needed.id, windows.id, openings.id],
        },
      ],
      fields: [facade, trim, needed, windows, openings],
    };

    const hidden = evaluateFormContext({
      form,
      settings: defaultSettings,
      materialsTotal: 0,
      fieldValues: { ikkunat_lkm: '16' },
    });
    expect(hidden.context.ikkunat_ovet_tarvitaan).toBe(0);
    expect(hidden.context.ikkunat_lkm).toBe(0);
    expect(hidden.context.aukkovahennykset).toBe(0);

    const shown = evaluateFormContext({
      form,
      settings: defaultSettings,
      materialsTotal: 0,
      fieldValues: {
        julkisivupinnat_valinta: 'true',
        ikkunat_lkm: '16',
      },
    });
    expect(shown.context.ikkunat_ovet_tarvitaan).toBe(1);
    expect(shown.context.ikkunat_lkm).toBe(16);
    expect(shown.context.aukkovahennykset).toBeCloseTo(24);
  });
});
