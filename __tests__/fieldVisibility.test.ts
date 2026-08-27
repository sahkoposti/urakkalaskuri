import {
  comparableFieldValue,
  filterVisibleFields,
  formHasComputedShowWhen,
  isFieldVisible,
  omitHiddenFieldValues,
  visibilityConditionSummary,
} from '../src/core/form/fieldVisibility';
import type { FormDefinition, FormField } from '../src/core/form/types';
import { validateFormPageWithValues } from '../src/core/wizard/wizardPageHelpers';

function baseField(partial: Partial<FormField> & Pick<FormField, 'id' | 'key' | 'label' | 'type'>): FormField {
  return {
    required: false,
    showOnSummary: true,
    ...partial,
  };
}

function sampleForm(): FormDefinition {
  const raystaat = baseField({
    id: 'f_raystaat',
    key: 'raystaan_aluset_ja_otsalaudat',
    label: 'Räystäänaluset ja otsalaudat',
    type: 'boolean',
  });
  const metrit = baseField({
    id: 'f_metrit',
    key: 'raystasmetrit',
    label: 'Räystäsmetrit',
    type: 'number',
    unit: 'm',
    required: true,
    showWhen: { fieldKey: 'raystaan_aluset_ja_otsalaudat', operator: 'eq', value: 'true' },
  });
  const laudoitus = baseField({
    id: 'f_laudoitus',
    key: 'laudoitustyyppi',
    label: 'Laudoitustyyppi',
    type: 'select',
    options: [
      { label: 'Paneeli', value: '1.15' },
      { label: 'Hirsi', value: '1.3' },
    ],
  });
  const hirsiExtra = baseField({
    id: 'f_hirsi',
    key: 'hirsi_lisatyo',
    label: 'Hirren lisätyö',
    type: 'number',
    showWhen: { fieldKey: 'laudoitustyyppi', operator: 'eq', value: '1.3' },
  });

  return {
    id: 'form_test',
    name: 'Testi',
    version: 1,
    updatedAt: 0,
    pages: [
      {
        id: 'page_1',
        title: 'Pinta-alat',
        sortOrder: 0,
        fieldIds: [raystaat.id, metrit.id, laudoitus.id, hirsiExtra.id],
      },
    ],
    fields: [raystaat, metrit, laudoitus, hirsiExtra],
  };
}

describe('fieldVisibility', () => {
  test('boolean JSON true/false values do not crash and match kytkin', () => {
    const form = sampleForm();
    const metrit = form.fields.find((f) => f.key === 'raystasmetrit')!;
    metrit.showWhen = {
      fieldKey: 'raystaan_aluset_ja_otsalaudat',
      operator: 'eq',
      value: true as unknown as string,
    };

    expect(() => isFieldVisible(metrit, { raystaan_aluset_ja_otsalaudat: 'true' }, form)).not.toThrow();
    expect(isFieldVisible(metrit, { raystaan_aluset_ja_otsalaudat: 'true' }, form)).toBe(true);
    expect(isFieldVisible(metrit, { raystaan_aluset_ja_otsalaudat: 'false' }, form)).toBe(false);
    expect(isFieldVisible(metrit, {}, form)).toBe(false);

    metrit.showWhen = {
      fieldKey: 'raystaan_aluset_ja_otsalaudat',
      operator: 'eq',
      value: false as unknown as string,
    };
    expect(isFieldVisible(metrit, {}, form)).toBe(true);
    expect(isFieldVisible(metrit, { raystaan_aluset_ja_otsalaudat: 'true' }, form)).toBe(false);
  });

  test('numeric JSON 1 in showWhen does not crash', () => {
    const form = sampleForm();
    const field = baseField({
      id: 'f_count',
      key: 'ikkunat_lkm',
      label: 'Ikkunat',
      type: 'number',
      showWhen: {
        fieldKey: 'pinta_ala',
        operator: 'eq',
        value: 1 as unknown as string,
      },
    });
    form.fields.push(
      baseField({
        id: 'f_pinta',
        key: 'pinta_ala',
        label: 'Pinta-ala',
        type: 'number',
      }),
      field,
    );

    expect(() => isFieldVisible(field, { pinta_ala: '1' }, form)).not.toThrow();
    expect(isFieldVisible(field, { pinta_ala: '1' }, form)).toBe(true);
    expect(isFieldVisible(field, { pinta_ala: '2' }, form)).toBe(false);
  });

  test('boolean true shows dependent field', () => {
    const form = sampleForm();
    const metrit = form.fields.find((f) => f.key === 'raystasmetrit')!;

    expect(isFieldVisible(metrit, { raystaan_aluset_ja_otsalaudat: 'true' }, form)).toBe(true);
    expect(isFieldVisible(metrit, { raystaan_aluset_ja_otsalaudat: 'false' }, form)).toBe(false);
    expect(isFieldVisible(metrit, {}, form)).toBe(false);
  });

  test('select option equality shows dependent field', () => {
    const form = sampleForm();
    const hirsi = form.fields.find((f) => f.key === 'hirsi_lisatyo')!;

    expect(isFieldVisible(hirsi, { laudoitustyyppi: '1.3' }, form)).toBe(true);
    expect(isFieldVisible(hirsi, { laudoitustyyppi: '1.15' }, form)).toBe(false);
  });

  test('neq operator hides when equal', () => {
    const form = sampleForm();
    const field = baseField({
      id: 'f_other',
      key: 'muu',
      label: 'Muu',
      type: 'number',
      showWhen: { fieldKey: 'laudoitustyyppi', operator: 'neq', value: '1.3' },
    });

    expect(isFieldVisible(field, { laudoitustyyppi: '1.15' }, form)).toBe(true);
    expect(isFieldVisible(field, { laudoitustyyppi: '1.3' }, form)).toBe(false);
  });

  test('cascades when dependency itself is hidden', () => {
    const form = sampleForm();
    const mid = baseField({
      id: 'f_mid',
      key: 'keski',
      label: 'Keski',
      type: 'boolean',
      showWhen: { fieldKey: 'raystaan_aluset_ja_otsalaudat', value: 'true' },
    });
    const leaf = baseField({
      id: 'f_leaf',
      key: 'lehti',
      label: 'Lehti',
      type: 'number',
      showWhen: { fieldKey: 'keski', value: 'true' },
    });
    form.fields.push(mid, leaf);

    expect(
      isFieldVisible(leaf, { raystaan_aluset_ja_otsalaudat: 'false', keski: 'true' }, form),
    ).toBe(false);
    expect(
      isFieldVisible(leaf, { raystaan_aluset_ja_otsalaudat: 'true', keski: 'true' }, form),
    ).toBe(true);
  });

  test('filterVisibleFields and omitHiddenFieldValues', () => {
    const form = sampleForm();
    const values = {
      raystaan_aluset_ja_otsalaudat: 'false',
      raystasmetrit: '12',
      laudoitustyyppi: '1.15',
      hirsi_lisatyo: '5',
    };

    const visible = filterVisibleFields(form.fields, values, form).map((f) => f.key);
    expect(visible).toContain('raystaan_aluset_ja_otsalaudat');
    expect(visible).not.toContain('raystasmetrit');
    expect(visible).not.toContain('hirsi_lisatyo');

    const omitted = omitHiddenFieldValues(form, values);
    expect(omitted.raystasmetrit).toBeUndefined();
    expect(omitted.hirsi_lisatyo).toBeUndefined();
    expect(omitted.raystaan_aluset_ja_otsalaudat).toBe('false');
  });

  test('comparableFieldValue treats empty boolean as false', () => {
    const field = baseField({
      id: 'b',
      key: 'b',
      label: 'B',
      type: 'boolean',
    });
    expect(comparableFieldValue(field, undefined)).toBe('false');
    expect(comparableFieldValue(field, 'true')).toBe('true');
  });

  test('visibilityConditionSummary uses Finnish labels', () => {
    const form = sampleForm();
    const metrit = form.fields.find((f) => f.key === 'raystasmetrit')!;
    expect(visibilityConditionSummary(metrit.showWhen, form)).toBe(
      'Räystäänaluset ja otsalaudat = Kyllä',
    );
  });

  test('numeric gt/lt/gte/lte on number fields', () => {
    const form = sampleForm();
    const pinta = baseField({
      id: 'f_pinta',
      key: 'pinta_ala',
      label: 'Pinta-ala',
      type: 'number',
      unit: 'm2',
    });
    const lisarivi = baseField({
      id: 'f_lisa',
      key: 'lisarivi',
      label: 'Lisärivi',
      type: 'text',
      showWhen: { fieldKey: 'pinta_ala', operator: 'gt', value: '100' },
    });
    form.fields.push(pinta, lisarivi);

    expect(isFieldVisible(lisarivi, { pinta_ala: '120' }, form)).toBe(true);
    expect(isFieldVisible(lisarivi, { pinta_ala: '100' }, form)).toBe(false);
    expect(isFieldVisible(lisarivi, { pinta_ala: '80' }, form)).toBe(false);
    expect(isFieldVisible(lisarivi, { pinta_ala: '100,5' }, form)).toBe(true);

    lisarivi.showWhen = { fieldKey: 'pinta_ala', operator: 'gte', value: '100' };
    expect(isFieldVisible(lisarivi, { pinta_ala: '100' }, form)).toBe(true);
    expect(isFieldVisible(lisarivi, { pinta_ala: '99' }, form)).toBe(false);

    lisarivi.showWhen = { fieldKey: 'pinta_ala', operator: 'lt', value: '50' };
    expect(isFieldVisible(lisarivi, { pinta_ala: '49' }, form)).toBe(true);
    expect(isFieldVisible(lisarivi, { pinta_ala: '50' }, form)).toBe(false);

    lisarivi.showWhen = { fieldKey: 'pinta_ala', operator: 'lte', value: '50' };
    expect(isFieldVisible(lisarivi, { pinta_ala: '50' }, form)).toBe(true);

    lisarivi.showWhen = { fieldKey: 'pinta_ala', operator: 'eq', value: '12,5' };
    expect(isFieldVisible(lisarivi, { pinta_ala: '12.5' }, form)).toBe(true);
  });

  test('numeric operator on boolean source is never visible', () => {
    const form = sampleForm();
    const field = baseField({
      id: 'f_bad',
      key: 'huono',
      label: 'Huono',
      type: 'number',
      showWhen: {
        fieldKey: 'raystaan_aluset_ja_otsalaudat',
        operator: 'gt',
        value: '0',
      },
    });
    expect(isFieldVisible(field, { raystaan_aluset_ja_otsalaudat: 'true' }, form)).toBe(false);
  });

  test('computed showWhen uses numeric context', () => {
    const needed = baseField({
      id: 'f_needed',
      key: 'ikkunat_ovet_tarvitaan',
      label: 'Ikkuna- ja ovitiedot tarvitaan',
      type: 'computed',
      formula: 'max(julkisivu, pielus)',
    });
    const windows = baseField({
      id: 'f_windows',
      key: 'ikkunat_lkm',
      label: 'Ikkunat',
      type: 'number',
      showWhen: { fieldKey: 'ikkunat_ovet_tarvitaan', operator: 'eq', value: '1' },
    });
    const form: FormDefinition = {
      id: 'computed-vis',
      name: 'Computed vis',
      version: 1,
      updatedAt: 0,
      pages: [{ id: 'p1', title: 'Sivu', sortOrder: 0, fieldIds: [needed.id, windows.id] }],
      fields: [needed, windows],
    };

    expect(isFieldVisible(windows, {}, form)).toBe(false);
    expect(isFieldVisible(windows, {}, form, new Set(), { ikkunat_ovet_tarvitaan: 0 })).toBe(false);
    expect(isFieldVisible(windows, {}, form, new Set(), { ikkunat_ovet_tarvitaan: 1 })).toBe(true);

    const visible = filterVisibleFields(form.fields, {}, form, { ikkunat_ovet_tarvitaan: 1 }).map(
      (item) => item.key,
    );
    expect(visible).toContain('ikkunat_lkm');
    expect(formHasComputedShowWhen(form)).toBe(true);
    expect(formHasComputedShowWhen(sampleForm())).toBe(false);
  });

  test('visibilityConditionSummary for numeric gt', () => {
    const form = sampleForm();
    form.fields.push(
      baseField({
        id: 'f_pinta',
        key: 'pinta_ala',
        label: 'Pinta-ala',
        type: 'number',
      }),
    );
    expect(
      visibilityConditionSummary(
        { fieldKey: 'pinta_ala', operator: 'gt', value: '100' },
        form,
      ),
    ).toBe('Pinta-ala > 100');
  });

  test('validation skips required hidden fields', () => {
    const form = sampleForm();
    const page = form.pages[0];
    const error = validateFormPageWithValues(form, page, {
      raystaan_aluset_ja_otsalaudat: 'false',
    });
    expect(error).toBeNull();

    const missing = validateFormPageWithValues(form, page, {
      raystaan_aluset_ja_otsalaudat: 'true',
    });
    expect(missing).toContain('Räystäsmetrit');
  });

  test('customer page still requires name and validates extra fields', () => {
    const extra = baseField({
      id: 'f_extra',
      key: 'tyomaa',
      label: 'Työmaa',
      type: 'text',
      required: true,
    });
    const form = sampleForm();
    form.fields.push(extra);
    const customerPage = {
      id: 'page_customer',
      title: 'Asiakas',
      sortOrder: 0,
      system: 'customer' as const,
      fieldIds: ['f_extra'],
    };
    form.pages.unshift(customerPage);

    expect(validateFormPageWithValues(form, customerPage, {}, '')).toBe('Anna asiakkaan nimi.');
    expect(validateFormPageWithValues(form, customerPage, {}, 'Matti')).toContain('Työmaa');
    expect(validateFormPageWithValues(form, customerPage, { tyomaa: 'Talo' }, 'Matti')).toBeNull();
  });

  test('required select with defaultValue is valid before the user chooses', () => {
    const form = sampleForm();
    const laudoitus = form.fields.find((item) => item.key === 'laudoitustyyppi')!;
    laudoitus.required = true;
    laudoitus.defaultValue = '1.15';
    const page = form.pages[0];

    expect(validateFormPageWithValues(form, page, {})).toBeNull();
  });
});
