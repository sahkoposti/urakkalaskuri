import { normalizeFormDefinitionWithWarnings } from '../src/core/form/formDefinitionHelpers';
import {
  normalizePrintSettings,
  passesPrintWhen,
  resolveTargetPrint,
  type ResolvedPrint,
} from '../src/core/form/printSettings';
import type { FormDefinition, FormField, PrintWhen } from '../src/core/form/types';

function field(partial: Partial<FormField> & Pick<FormField, 'id' | 'key' | 'type'>): FormField {
  return {
    label: partial.key,
    required: false,
    showOnSummary: true,
    ...partial,
  };
}

function formOf(...fields: FormField[]): FormDefinition {
  return {
    id: 'test',
    name: 'Testi',
    version: 1,
    updatedAt: 1,
    pages: [{ id: 'p1', title: 'Sivu', sortOrder: 0, fieldIds: fields.map((item) => item.id) }],
    fields,
  };
}

const numberField = field({ id: 'n', key: 'mitta', type: 'number' });
const boolField = field({ id: 'b', key: 'lippu', type: 'boolean' });

describe('normalizePrintSettings', () => {
  test('undefined print is legacy and does not warn', () => {
    expect(normalizePrintSettings(undefined, numberField, formOf(numberField))).toEqual({ warnings: [] });
  });

  test.each([
    ['x'],
    [[] as unknown[]],
    [null],
  ])('print %s falls back to legacy with one warning', (raw: unknown) => {
    const result = normalizePrintSettings(raw, numberField, formOf(numberField));
    expect(result.print).toBeUndefined();
    expect(result.warnings).toEqual(['Kenttä "mitta": print ei ole objekti, ohitettu']);
    const again = normalizePrintSettings(result.print, numberField, formOf(numberField));
    expect(again).toEqual({ warnings: [] });
  });

  test('true on a target is kept and equals an empty object when resolved', () => {
    const asTrue = normalizePrintSettings({ offer: true }, numberField, formOf(numberField));
    const asEmpty = normalizePrintSettings({ offer: {} }, numberField, formOf(numberField));
    expect(asTrue).toEqual({ print: { offer: true }, warnings: [] });
    expect(asEmpty).toEqual({ print: { offer: {} }, warnings: [] });
    const form = formOf(numberField);
    expect(resolveTargetPrint({ ...numberField, print: asTrue.print }, 'offer', form)).toEqual(
      resolveTargetPrint({ ...numberField, print: asEmpty.print }, 'offer', form),
    );
  });

  test('empty print object resolves to null for both targets', () => {
    const form = formOf(numberField);
    const withEmpty = { ...numberField, print: {} as const };
    expect(resolveTargetPrint(withEmpty, 'offer', form)).toBeNull();
    expect(resolveTargetPrint(withEmpty, 'urakkakortti', form)).toBeNull();
  });

  test('unknown when is removed, unknown group becomes tieto, bad order and label are removed', () => {
    const when = normalizePrintSettings({ when: 'y', offer: true }, numberField, formOf(numberField));
    expect(when.warnings).toEqual(['Kenttä "mitta": tuntematon print.when "y" ohitettu']);
    expect(when.print).toEqual({ offer: true });

    const group = normalizePrintSettings({ offer: { group: 'y' } }, numberField, formOf(numberField));
    expect(group.warnings).toEqual(['Kenttä "mitta": tuntematon print.offer.group "y" ohitettu']);
    expect(group.print).toEqual({ offer: { group: 'tieto' } });

    const order = normalizePrintSettings({ offer: { order: '3' } }, numberField, formOf(numberField));
    expect(order.warnings).toEqual(['Kenttä "mitta": virheellinen print.offer.order "3" ohitettu']);
    expect(order.print).toEqual({ offer: {} });

    const nan = normalizePrintSettings({ offer: { order: Number.NaN } }, numberField, formOf(numberField));
    expect(nan.warnings).toEqual(['Kenttä "mitta": virheellinen print.offer.order NaN ohitettu']);
    expect(nan.print).toEqual({ offer: {} });

    const label = normalizePrintSettings({ offer: { label: 5 } }, numberField, formOf(numberField));
    expect(label.warnings).toEqual(['Kenttä "mitta": virheellinen print.offer.label 5 ohitettu']);
    expect(label.print).toEqual({ offer: {} });
  });

  test('unknown target and a target that is not true or an object are dropped', () => {
    const unknown = normalizePrintSettings({ invoice: true, offer: true }, numberField, formOf(numberField));
    expect(unknown.warnings).toEqual(['Kenttä "mitta": tuntematon tulostuskohde "invoice" ohitettu']);
    expect(unknown.print).toEqual({ offer: true });

    const off = normalizePrintSettings({ offer: false }, numberField, formOf(numberField));
    expect(off.warnings).toEqual(['Kenttä "mitta": print.offer ei ole true tai objekti, ohitettu']);
    expect(off.print).toEqual({});

    const one = normalizePrintSettings({ urakkakortti: 1 }, numberField, formOf(numberField));
    expect(one.warnings).toEqual(['Kenttä "mitta": print.urakkakortti ei ole true tai objekti, ohitettu']);
    expect(one.print).toEqual({});

    const form = formOf(numberField);
    expect(resolveTargetPrint({ ...numberField, print: off.print }, 'offer', form)).toBeNull();
  });

  test('invalid quantityKey is removed in each case', () => {
    const paint = field({ id: 'm', key: 'kaytettava_maali', type: 'product_select' });
    const qty = field({ id: 'q', key: 'savyjen_lkm', type: 'number' });
    const catalog = formOf(paint, qty);

    const missing = normalizePrintSettings(
      { urakkakortti: { group: 'maali', quantityKey: 'puuttuu' } },
      paint,
      catalog,
    );
    expect(missing.warnings).toEqual([
      'Kenttä "kaytettava_maali": virheellinen print.urakkakortti.quantityKey "puuttuu" ohitettu',
    ]);
    expect(missing.print).toEqual({ urakkakortti: { group: 'maali' } });

    const wrongGroup = normalizePrintSettings(
      { urakkakortti: { group: 'tieto', quantityKey: 'savyjen_lkm' } },
      paint,
      catalog,
    );
    expect(wrongGroup.warnings).toEqual([
      'Kenttä "kaytettava_maali": virheellinen print.urakkakortti.quantityKey "savyjen_lkm" ohitettu',
    ]);
    expect(wrongGroup.print).toEqual({ urakkakortti: { group: 'tieto' } });

    const notProduct = normalizePrintSettings(
      { urakkakortti: { group: 'maali', quantityKey: 'savyjen_lkm' } },
      qty,
      catalog,
    );
    expect(notProduct.warnings).toEqual([
      'Kenttä "savyjen_lkm": virheellinen print.urakkakortti.quantityKey "savyjen_lkm" ohitettu',
    ]);
    expect(notProduct.print).toEqual({ urakkakortti: { group: 'maali' } });

    const onOffer = normalizePrintSettings({ offer: { quantityKey: 'savyjen_lkm' } }, paint, catalog);
    expect(onOffer.warnings).toEqual([
      'Kenttä "kaytettava_maali": print.offer.quantityKey ei ole sallittu, ohitettu',
    ]);
    expect(onOffer.print).toEqual({ offer: {} });
  });

  test('valid quantityKey is kept, including a system field key during form normalize', () => {
    const paint = field({ id: 'm', key: 'kaytettava_maali', type: 'product_select', label: 'Maali' });
    const qty = field({ id: 'q', key: 'savyjen_lkm', type: 'number' });
    const direct = normalizePrintSettings(
      { urakkakortti: { group: 'maali', quantityKey: 'savyjen_lkm' } },
      paint,
      formOf(paint, qty),
    );
    expect(direct.warnings).toEqual([]);
    expect(direct.print).toEqual({ urakkakortti: { group: 'maali', quantityKey: 'savyjen_lkm' } });

    const imported = normalizeFormDefinitionWithWarnings({
      id: 'test',
      name: 'Testi',
      version: 1,
      updatedAt: 1,
      pages: [{ id: 'p1', title: 'Sivu', sortOrder: 0, fieldIds: ['m'] }],
      fields: [
        {
          ...paint,
          print: { urakkakortti: { group: 'maali', quantityKey: 'tyoryhma_kesto_pv' } },
        },
      ],
    });
    expect(imported.warnings).toEqual([]);
    expect(imported.form.fields.find((item) => item.key === 'kaytettava_maali')?.print).toEqual({
      urakkakortti: { group: 'maali', quantityKey: 'tyoryhma_kesto_pv' },
    });
  });

  test('is idempotent', () => {
    const paint = field({ id: 'm', key: 'kaytettava_maali', type: 'product_select' });
    const raw = {
      when: 'nope',
      invoice: true,
      offer: { group: 'foo', order: '3', label: 5, quantityKey: 'savyjen_lkm', extra: 1 },
      urakkakortti: { when: 'always', quantityKey: 'puuttuu' },
    };
    const first = normalizePrintSettings(raw, paint, formOf(paint));
    const second = normalizePrintSettings(first.print, paint, formOf(paint));
    expect(second.warnings).toEqual([]);
    expect(second.print).toEqual(first.print);
    expect(first.print).toEqual({
      offer: { group: 'tieto' },
      urakkakortti: { when: 'always' },
    });
  });

  test('does not throw on garbage', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    circular.offer = circular;
    const junk: unknown[] = [undefined, null, 0, 1, false, true, 'x', [], {}, { offer: false }, circular];
    for (const value of junk) {
      expect(() => normalizePrintSettings(value, numberField, formOf(numberField))).not.toThrow();
      expect(() => normalizePrintSettings(value, null as unknown as FormField, null as unknown as FormDefinition)).not.toThrow();
    }
    expect(() => resolveTargetPrint(null as unknown as FormField, 'offer', formOf(numberField))).not.toThrow();
    expect(() => passesPrintWhen('notEmpty', null as unknown as FormField, undefined, Number.NaN)).not.toThrow();
  });
});

describe('resolveTargetPrint defaults', () => {
  test('boolean defaults to ifYes and other types to notEmpty, group tieto', () => {
    const form = formOf(boolField, numberField);
    const expectDefaults = (type: FormField['type'], when: ResolvedPrint['when']) => {
      const item = field({ id: type, key: type, type, print: { offer: true } });
      expect(resolveTargetPrint(item, 'offer', formOf(item))).toEqual({ when, group: 'tieto', legacy: false });
    };
    expectDefaults('boolean', 'ifYes');
    expectDefaults('number', 'notEmpty');
    expectDefaults('text', 'notEmpty');
    expectDefaults('select', 'notEmpty');
    expectDefaults('product_select', 'notEmpty');
    expectDefaults('computed', 'notEmpty');
    expect(resolveTargetPrint({ ...boolField, print: { offer: true } }, 'urakkakortti', form)).toBeNull();
  });

  test('target when overrides the top-level when', () => {
    const item = field({
      id: 'b',
      key: 'lippu',
      type: 'boolean',
      print: { when: 'always', offer: { when: 'ifYes' }, urakkakortti: true },
    });
    const form = formOf(item);
    expect(resolveTargetPrint(item, 'offer', form)?.when).toBe('ifYes');
    expect(resolveTargetPrint(item, 'urakkakortti', form)?.when).toBe('always');
  });

  test('legacy offer and urakkakortti differ for booleans, euros and the customer page', () => {
    const flag = field({ id: 'b', key: 'lippu', type: 'boolean' });
    const euro = field({ id: 'e', key: 'hinta', type: 'number', unit: '€' });
    const section = field({ id: 'sec', key: 'otsikko', type: 'section' });
    const system = field({
      id: 'sys',
      key: 'tyoryhma_kesto_pv',
      type: 'computed',
      systemKey: 'tyoryhma_kesto_pv',
    });
    const hidden = field({ id: 'h', key: 'piilo', type: 'text', showOnSummary: false });
    const note = field({ id: 'c', key: 'huom', type: 'text' });
    const form = formOf(flag, euro, section, system, hidden, note);
    form.pages = [
      { id: 'cust', title: 'Asiakas', sortOrder: 0, system: 'customer', fieldIds: ['c'] },
      { id: 'p1', title: 'Sivu', sortOrder: 1, fieldIds: ['b', 'e', 'sec', 'sys', 'h'] },
    ];

    expect(resolveTargetPrint(flag, 'offer', form)).toEqual({ when: 'ifYes', group: 'tieto', legacy: true });
    expect(resolveTargetPrint(flag, 'urakkakortti', form)).toEqual({ when: 'always', group: 'tieto', legacy: true });
    expect(resolveTargetPrint(euro, 'offer', form)).toBeNull();
    expect(resolveTargetPrint(euro, 'urakkakortti', form)).toBeNull();
    expect(resolveTargetPrint(section, 'offer', form)).toBeNull();
    expect(resolveTargetPrint({ ...section, print: { offer: true } }, 'offer', form)).toBeNull();
    expect(resolveTargetPrint(system, 'offer', form)).toBeNull();
    expect(resolveTargetPrint({ ...system, print: { urakkakortti: true } }, 'urakkakortti', form)).toBeNull();
    expect(resolveTargetPrint(hidden, 'offer', form)).toBeNull();
    expect(resolveTargetPrint(note, 'urakkakortti', form)).toBeNull();
    expect(resolveTargetPrint(note, 'offer', form)).toEqual({ when: 'notEmpty', group: 'tieto', legacy: true });
  });
});

describe('passesPrintWhen', () => {
  const types = ['boolean', 'number', 'text', 'select', 'product_select'] as const;

  function item(type: (typeof types)[number]): FormField {
    return field({ id: type, key: type, type });
  }

  const matrix: Array<[PrintWhen, (typeof types)[number], string | undefined, number | undefined, boolean]> = [
    ['always', 'boolean', 'true', undefined, true],
    ['always', 'boolean', 'false', undefined, true],
    ['always', 'boolean', undefined, undefined, true],
    ['notEmpty', 'boolean', 'false', undefined, true],
    ['notEmpty', 'boolean', undefined, undefined, true],
    ['ifYes', 'boolean', 'true', undefined, true],
    ['ifYes', 'boolean', 'false', undefined, false],
    ['ifYes', 'boolean', undefined, undefined, false],
    ['always', 'number', undefined, 0, true],
    ['always', 'number', undefined, 5, true],
    ['always', 'number', undefined, undefined, false],
    ['notEmpty', 'number', undefined, 0, false],
    ['notEmpty', 'number', undefined, 5, true],
    ['ifYes', 'number', undefined, 0, false],
    ['ifYes', 'number', undefined, 5, true],
    ['always', 'text', '', undefined, false],
    ['always', 'text', '   ', undefined, false],
    ['always', 'text', 'x', undefined, true],
    ['notEmpty', 'text', '', undefined, false],
    ['notEmpty', 'text', 'x', undefined, true],
    ['ifYes', 'text', '', undefined, false],
    ['ifYes', 'text', 'x', undefined, true],
    ['always', 'select', '', undefined, false],
    ['always', 'select', '1.15', undefined, true],
    ['notEmpty', 'select', '', undefined, false],
    ['notEmpty', 'select', '1.15', undefined, true],
    ['ifYes', 'select', '', undefined, false],
    ['ifYes', 'select', '1.15', undefined, true],
    ['always', 'product_select', '', undefined, false],
    ['always', 'product_select', 'p1', undefined, true],
    ['notEmpty', 'product_select', '', undefined, false],
    ['notEmpty', 'product_select', 'p1', undefined, true],
    ['ifYes', 'product_select', '', undefined, false],
    ['ifYes', 'product_select', 'p1', undefined, true],
  ];

  test.each(matrix)('%s %s raw=%s num=%s → %s', (when, type, raw, num, expected) => {
    expect(passesPrintWhen(when, item(type), raw, num)).toBe(expected);
  });

  test('computed follows the number rule', () => {
    const computed = field({ id: 'c', key: 'ala', type: 'computed' });
    expect(passesPrintWhen('always', computed, undefined, 0)).toBe(true);
    expect(passesPrintWhen('notEmpty', computed, undefined, 0)).toBe(false);
    expect(passesPrintWhen('ifYes', computed, undefined, 5)).toBe(true);
  });
});
