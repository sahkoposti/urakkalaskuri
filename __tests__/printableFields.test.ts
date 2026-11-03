import { formatFieldSummaryValue } from '../src/core/form/formSummaryHelpers';
import type { FormDefinition, FormField, FormPage } from '../src/core/form/types';
import type { Product } from '../src/core/models/types';
import { groupPrintRows, printableFields, type PrintableFieldsInput } from '../src/core/pdf/printableFields';
import { urakkakorttiSpecCards } from '../src/core/pdf/urakkakortti';
import { formatDecimal } from '../src/core/utils/formatters';
import { form, input, record } from './pdfFixtures';

function field(partial: Partial<FormField> & Pick<FormField, 'id' | 'key' | 'type'>): FormField {
  return {
    label: partial.key,
    required: false,
    showOnSummary: true,
    ...partial,
  };
}

function formWith(fields: FormField[], pages?: FormPage[]): FormDefinition {
  return {
    id: 'test',
    name: 'Testi',
    version: 1,
    updatedAt: 1,
    pages: pages ?? [{ id: 'p1', title: 'Sivu', sortOrder: 0, fieldIds: fields.map((item) => item.id) }],
    fields,
  };
}

function rows(
  definition: FormDefinition,
  partial: Partial<PrintableFieldsInput> & Pick<PrintableFieldsInput, 'target'>,
) {
  return printableFields({
    form: definition,
    fieldValues: {},
    context: {},
    products: [],
    ...partial,
  });
}

const product: Product = {
  id: 'p1',
  name: 'Ultra',
  unit: 'l',
  unitPriceVat0: 10,
  createdAt: new Date(2026, 0, 1),
};

describe('printableFields legacy', () => {
  test('offer keeps showOnSummary and showOnSummaryWhen, and hides euros, system fields and false booleans', () => {
    const flag = field({ id: 'b', key: 'lippu', type: 'boolean', label: 'Lippu' });
    const euro = field({ id: 'e', key: 'hinta', type: 'number', unit: '€', label: 'Hinta' });
    const system = field({
      id: 'sys',
      key: 'tyoryhma_kesto_pv',
      type: 'computed',
      systemKey: 'tyoryhma_kesto_pv',
      unit: 'pv',
      label: 'Työn kesto',
    });
    const gated = field({
      id: 'g',
      key: 'piilo',
      type: 'number',
      unit: 'm',
      label: 'Piilo',
      showOnSummaryWhen: { fieldKey: 'lippu', operator: 'eq', value: 'true' },
    });
    const shown = field({ id: 'n', key: 'mitta', type: 'number', unit: 'm', label: 'Mitta' });
    const off = field({ id: 'o', key: 'pois', type: 'text', label: 'Pois', showOnSummary: false });
    const definition = formWith([flag, euro, system, gated, shown, off]);

    const offer = rows(definition, {
      target: 'offer',
      fieldValues: { lippu: 'false', pois: 'teksti' },
      context: { hinta: 10, piilo: 3, mitta: 4, tyoryhma_kesto_pv: 2 },
    });
    expect(offer.map((row) => row.key)).toEqual(['mitta']);
    expect(offer[0]).toMatchObject({ group: 'tieto', value: `${formatDecimal(4)} m` });
    expect(offer[0].value.includes('€')).toBe(false);

    const card = rows(definition, {
      target: 'urakkakortti',
      fieldValues: { lippu: 'false', pois: 'teksti' },
      context: { hinta: 10, piilo: 3, mitta: 4, tyoryhma_kesto_pv: 2 },
    });
    expect(card.map((row) => row.key)).toEqual(['lippu', 'mitta']);
    expect(card[0].value).toBe('Ei');
  });

  test('legacy urakkakortti matches the non-empty pdf fixture spec rows and skips customer pages', () => {
    const rec = record({});
    const built = input(rec);
    const cards = urakkakorttiSpecCards({
      record: rec,
      company: built.company,
      structures: built.structures,
      products: built.products,
      settings: built.settings,
      generatedAt: built.generatedAt,
    });
    const line0 = rec.structureLines![0];
    const printed = rows(form, {
      target: 'urakkakortti',
      fieldValues: line0.fieldValues ?? {},
      context: {},
      products: built.products,
      snapshot: line0.snapshot,
    });
    const cardRows = cards.flatMap((card) => card.rows);
    const expected = (line0.snapshot?.fields ?? []).filter(
      (item) => item.value !== '–' && !item.value.includes('€'),
    );

    expect(cardRows.some((row) => row.value === '–')).toBe(true);
    expect(printed.map((row) => ({ key: row.key, label: row.label, value: row.value }))).toEqual(
      expected.map((item) => ({ key: item.key, label: item.label, value: item.value })),
    );
    expect(printed.map((row) => row.value)).toEqual(
      cardRows.filter((row) => row.value !== '–' && !row.value.includes('€')).map((row) => row.value),
    );
    expect(printed.every((row) => !row.value.includes('€'))).toBe(true);
    expect(printed.every((row) => row.group === 'tieto')).toBe(true);

    const customer = field({ id: 'c', key: 'asiakaslisa', type: 'text', label: 'Lisätieto' });
    const measure = field({ id: 'm', key: 'mitta', type: 'number', unit: 'm', label: 'Mitta' });
    const withCustomer = formWith(
      [customer, measure],
      [
        { id: 'cust', title: 'Asiakas', sortOrder: 0, system: 'customer', fieldIds: ['c'] },
        { id: 'p', title: 'Työ', sortOrder: 1, fieldIds: ['m'] },
      ],
    );
    const values = { fieldValues: { asiakaslisa: 'Hei', mitta: '2' }, context: { mitta: 2 } };
    expect(rows(withCustomer, { target: 'urakkakortti', ...values }).map((row) => row.key)).toEqual(['mitta']);
    expect(rows(withCustomer, { target: 'offer', ...values }).map((row) => row.key)).toEqual([
      'asiakaslisa',
      'mitta',
    ]);
  });
});

describe('printableFields explicit print', () => {
  test('overrides showOnSummary in both directions and {} prints nothing', () => {
    const hidden = field({
      id: 'h',
      key: 'piilo',
      type: 'number',
      unit: 'm',
      showOnSummary: false,
      print: { offer: true },
    });
    const summaryOnly = field({
      id: 's',
      key: 'yhteenveto',
      type: 'text',
      print: {},
    });
    const cardOnly = field({
      id: 'u',
      key: 'kortti',
      type: 'text',
      showOnSummary: false,
      print: { urakkakortti: true },
    });
    const definition = formWith([hidden, summaryOnly, cardOnly]);
    const inputRows = {
      fieldValues: { yhteenveto: 'nakyy', kortti: 'kortille' },
      context: { piilo: 5 },
    };

    expect(rows(definition, { target: 'offer', ...inputRows }).map((row) => row.key)).toEqual(['piilo']);
    expect(rows(definition, { target: 'urakkakortti', ...inputRows }).map((row) => row.key)).toEqual(['kortti']);
  });

  test('a wizard-hidden field is not printed', () => {
    const gate = field({ id: 'g', key: 'kaytossa', type: 'boolean', showOnSummary: false });
    const measure = field({
      id: 'm',
      key: 'mitta',
      type: 'number',
      showWhen: { fieldKey: 'kaytossa', operator: 'eq', value: 'true' },
      print: { offer: true, urakkakortti: true },
    });
    const definition = formWith([gate, measure]);
    expect(
      rows(definition, {
        target: 'offer',
        fieldValues: { kaytossa: 'false' },
        context: { mitta: 5 },
      }),
    ).toEqual([]);
    expect(
      rows(definition, {
        target: 'offer',
        fieldValues: { kaytossa: 'true' },
        context: { mitta: 5 },
      }).map((row) => row.key),
    ).toEqual(['mitta']);
  });

  test('urakkakortti drops an explicit euro row, including a value that contains €', () => {
    const price = field({
      id: 'e',
      key: 'hinta',
      type: 'number',
      unit: '€',
      showOnSummary: false,
      print: { offer: true, urakkakortti: true },
    });
    const note = field({
      id: 'n',
      key: 'huom',
      type: 'text',
      showOnSummary: false,
      print: { offer: true, urakkakortti: true },
    });
    const definition = formWith([price, note]);
    const inputRows = { fieldValues: { huom: 'sis. 10 €' }, context: { hinta: 10 } };
    expect(rows(definition, { target: 'urakkakortti', ...inputRows })).toEqual([]);
    expect(rows(definition, { target: 'offer', ...inputRows }).map((row) => row.key)).toEqual(['hinta', 'huom']);
  });

  test('snapshot value wins over a recompute that would be empty under notEmpty', () => {
    const area = field({ id: 'a', key: 'pinta', type: 'number', unit: 'm²', label: 'Pinta-ala' });
    const definition = formWith([area]);
    const context = { pinta: 0 };
    const live = formatFieldSummaryValue(area, { pinta: '0' }, context, []);
    expect(live.startsWith(formatDecimal(0))).toBe(true);
    const printed = rows(definition, {
      target: 'offer',
      fieldValues: { pinta: '0' },
      context,
      snapshot: {
        formId: 'test',
        formVersion: 1,
        fields: [{ key: 'pinta', label: 'Pinta-ala', value: '120,0 m²', unit: 'm²' }],
      },
    });
    expect(printed.map((row) => row.value)).toEqual(['120,0 m²']);
  });

  test('quantityKey, order, label and group are applied', () => {
    const paint = field({
      id: 'm',
      key: 'kaytettava_maali',
      type: 'product_select',
      label: 'Käytettävä maali',
      showOnSummary: false,
      print: {
        urakkakortti: { group: 'maali', quantityKey: 'savyjen_lkm', order: 5, label: '' },
      },
    });
    const shades = field({ id: 'q', key: 'savyjen_lkm', type: 'number', unit: 'kpl', label: 'Sävyt', showOnSummary: false });
    const later = field({
      id: 't',
      key: 'huom',
      type: 'text',
      label: 'Työn kesto',
      showOnSummary: false,
      print: { offer: { group: 'osa_alueet', order: 1, label: 'Huom' }, urakkakortti: { order: 20 } },
    });
    const definition = formWith([paint, shades, later]);
    const printed = rows(definition, {
      target: 'urakkakortti',
      fieldValues: { kaytettava_maali: 'p1', savyjen_lkm: '2', huom: 'tikkaat' },
      context: { savyjen_lkm: 2 },
      products: [product],
    });

    expect(printed.map((row) => row.key)).toEqual(['kaytettava_maali', 'huom']);
    expect(printed[0]).toMatchObject({
      label: '',
      value: 'Ultra',
      group: 'maali',
      order: 5,
      quantity: { value: formatDecimal(2), unit: 'kpl' },
    });
    expect(printed[1]).toMatchObject({
      label: 'Työn arvioitu kesto',
      value: 'tikkaat',
      group: 'tieto',
      order: 20,
    });

    const grouped = groupPrintRows(printed);
    expect(Object.keys(grouped).sort()).toEqual(['maali', 'muuta', 'osa_alueet', 'tieto', 'tyovaiheet']);
    expect(grouped.maali.map((row) => row.key)).toEqual(['kaytettava_maali']);
    expect(grouped.tieto.map((row) => row.key)).toEqual(['huom']);
    expect(grouped.osa_alueet).toEqual([]);
  });

  test('does not print a field that is not on a page, and does not throw on garbage', () => {
    const loose = field({ id: 'z', key: 'irrallinen', type: 'text' });
    const placed = field({ id: 'p', key: 'sivulla', type: 'text' });
    const definition = formWith(
      [loose, placed],
      [{ id: 'p1', title: 'Sivu', sortOrder: 0, fieldIds: ['p'] }],
    );
    expect(rows(definition, { target: 'offer', fieldValues: { irrallinen: 'x', sivulla: 'y' } }).map((row) => row.key)).toEqual([
      'sivulla',
    ]);
    expect(() => printableFields(undefined as unknown as PrintableFieldsInput)).not.toThrow();
    expect(printableFields(undefined as unknown as PrintableFieldsInput)).toEqual([]);
  });
});
