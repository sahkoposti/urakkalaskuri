import {
  comparableFieldValue,
  filterVisibleFields,
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
});
