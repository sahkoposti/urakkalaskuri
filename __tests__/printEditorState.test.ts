import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import {
  applyPrintEditorChange,
  canPrintOnUrakkakortti,
  isPrintEditable,
  legacyToExplicitState,
  printWhenOptions,
  quantityKeyOptions,
  readPrintEditorState,
  stateForTypeChange,
  writePrintEditorState,
  type PrintEditorState,
  type TargetEditorState,
} from '../src/core/form/printEditorState';
import type { FormDefinition, FormField, PrintWhen } from '../src/core/form/types';
import { printableFields } from '../src/core/pdf/printableFields';
import { form as pdfForm } from './pdfFixtures';

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

function state(partial: Partial<PrintEditorState> & Pick<PrintEditorState, 'offer' | 'urakkakortti'>): PrintEditorState {
  return {
    legacy: false,
    when: 'notEmpty',
    ...partial,
  };
}

function target(partial: Partial<TargetEditorState> = {}): TargetEditorState {
  return { group: 'tieto', ...partial };
}

const numberField = field({ id: 'n', key: 'mitta', type: 'number' });
const textField = field({ id: 't', key: 'teksti', type: 'text', label: 'Teksti' });
const boolField = field({ id: 'b', key: 'lippu', type: 'boolean', label: 'Lippu' });

describe('readPrintEditorState', () => {
  test('legacy showOnSummary boolean, text, euro, system field and section', () => {
    const euro = field({ id: 'e', key: 'hinta', type: 'number', unit: '€', label: 'Hinta' });
    const section = field({ id: 'sec', key: 'otsikko', type: 'section', label: 'Otsikko' });
    const system = field({
      id: 'sys',
      key: 'tyoryhma_kesto_pv',
      type: 'computed',
      systemKey: 'tyoryhma_kesto_pv',
      label: 'Työn kesto',
    });
    const hidden = field({ id: 'h', key: 'piilo', type: 'text', showOnSummary: false });
    const note = field({ id: 'c', key: 'huom', type: 'text', label: 'Huom' });
    const form = formOf(boolField, textField, euro, section, system, hidden, note);
    form.pages = [
      { id: 'cust', title: 'Asiakas', sortOrder: 0, system: 'customer', fieldIds: ['c'] },
      { id: 'p1', title: 'Sivu', sortOrder: 1, fieldIds: ['b', 't', 'e', 'sec', 'sys', 'h'] },
    ];

    expect(readPrintEditorState(boolField, form)).toEqual({
      legacy: true,
      when: 'ifYes',
      offer: target(),
      urakkakortti: target({ when: 'always' }),
    });
    expect(readPrintEditorState(textField, form)).toEqual({
      legacy: true,
      when: 'notEmpty',
      offer: target(),
      urakkakortti: target(),
    });
    expect(readPrintEditorState(euro, form)).toEqual({
      legacy: true,
      when: 'notEmpty',
      offer: null,
      urakkakortti: null,
    });
    expect(readPrintEditorState(note, form)).toEqual({
      legacy: true,
      when: 'notEmpty',
      offer: target(),
      urakkakortti: null,
    });
    expect(readPrintEditorState(hidden, form)).toEqual({
      legacy: true,
      when: 'notEmpty',
      offer: null,
      urakkakortti: null,
    });
    expect(isPrintEditable(system)).toBe(false);
    expect(readPrintEditorState(system, form)).toEqual({
      legacy: true,
      when: 'notEmpty',
      offer: null,
      urakkakortti: null,
    });
    expect(isPrintEditable(section)).toBe(false);
    expect(readPrintEditorState(section, form)).toEqual({
      legacy: true,
      when: 'notEmpty',
      offer: null,
      urakkakortti: null,
    });
  });

  test('explicit empty object, true targets and a full target object', () => {
    const form = formOf(numberField);
    expect(readPrintEditorState({ ...numberField, print: {} }, form)).toEqual({
      legacy: false,
      when: 'notEmpty',
      offer: null,
      urakkakortti: null,
    });

    const bothTrue = { ...numberField, print: { offer: true as const, urakkakortti: true as const } };
    expect(readPrintEditorState(bothTrue, form)).toEqual({
      legacy: false,
      when: 'notEmpty',
      offer: target(),
      urakkakortti: target(),
    });

    const paint = field({
      id: 'm',
      key: 'kaytettava_maali',
      type: 'product_select',
      label: 'Maali',
      print: {
        when: 'always',
        offer: { group: 'tyovaiheet', order: 3, label: 'Tarjousmaali' },
        urakkakortti: { when: 'notEmpty', group: 'maali', order: 0, label: '', quantityKey: 'litrat' },
      },
    });
    const qty = field({ id: 'q', key: 'litrat', type: 'number', label: 'Litrat' });
    const catalog = formOf(paint, qty);
    expect(readPrintEditorState(paint, catalog)).toEqual({
      legacy: false,
      when: 'always',
      offer: target({ group: 'tyovaiheet', order: 3, label: 'Tarjousmaali' }),
      urakkakortti: target({
        when: 'notEmpty',
        group: 'maali',
        order: 0,
        label: '',
        quantityKey: 'litrat',
      }),
    });
  });

  test('top-level when is the type default unless print.when is set', () => {
    const types: Array<[FormField['type'], PrintWhen]> = [
      ['boolean', 'ifYes'],
      ['number', 'notEmpty'],
      ['text', 'notEmpty'],
      ['select', 'notEmpty'],
      ['product_select', 'notEmpty'],
      ['computed', 'notEmpty'],
    ];
    for (const [type, when] of types) {
      const item = field({ id: type, key: type, type, print: { offer: true } });
      expect(readPrintEditorState(item, formOf(item)).when).toBe(when);
    }
    const overridden = { ...numberField, print: { when: 'always' as const, offer: true as const } };
    expect(readPrintEditorState(overridden, formOf(numberField)).when).toBe('always');
  });
});

describe('writePrintEditorState', () => {
  test('compacts defaults, drops a default or repeated when, and keeps an empty label', () => {
    const form = formOf(numberField, boolField);

    expect(writePrintEditorState(state({ offer: target(), urakkakortti: null }), numberField, form)).toEqual({
      offer: true,
    });
    expect(writePrintEditorState(state({ when: 'always', offer: null, urakkakortti: null }), numberField, form)).toEqual(
      {},
    );
    expect(
      writePrintEditorState(state({ when: 'ifYes', offer: target(), urakkakortti: null }), boolField, form),
    ).toEqual({ offer: true });
    expect(
      writePrintEditorState(
        state({ when: 'always', offer: target({ when: 'always' }), urakkakortti: null }),
        numberField,
        form,
      ),
    ).toEqual({ when: 'always', offer: true });
    expect(
      writePrintEditorState(state({ offer: target({ label: '' }), urakkakortti: null }), numberField, form),
    ).toEqual({ offer: { label: '' } });
  });

  test('invalid quantityKey is removed via normalize', () => {
    const paint = field({ id: 'm', key: 'kaytettava_maali', type: 'product_select' });
    const qty = field({ id: 'q', key: 'litrat', type: 'number' });
    const catalog = formOf(paint, qty);

    const notProduct = writePrintEditorState(
      state({
        offer: null,
        urakkakortti: target({ group: 'maali', quantityKey: 'litrat' }),
      }),
      qty,
      catalog,
    );
    expect(notProduct).toEqual({ urakkakortti: { group: 'maali' } });
    expect(JSON.stringify(notProduct)).not.toContain('quantityKey');

    const wrongGroup = writePrintEditorState(
      state({
        offer: null,
        urakkakortti: target({ group: 'tieto', quantityKey: 'litrat' }),
      }),
      paint,
      catalog,
    );
    expect(wrongGroup).toEqual({ urakkakortti: true });

    const onOffer = writePrintEditorState(
      state({ offer: target({ quantityKey: 'litrat' }), urakkakortti: null }),
      paint,
      catalog,
    );
    expect(onOffer).toEqual({ offer: true });
    expect(JSON.stringify(onOffer)).not.toContain('quantityKey');
  });
});

describe('round trip', () => {
  test('read(apply(read)) is stable for explicit print and for a legacy conversion', () => {
    const paint = field({
      id: 'm',
      key: 'kaytettava_maali',
      type: 'product_select',
      print: {
        when: 'always',
        offer: { group: 'osa_alueet', order: 2, label: 'Maali' },
        urakkakortti: { group: 'maali', label: '', quantityKey: 'litrat', when: 'notEmpty' },
      },
    });
    const qty = field({ id: 'q', key: 'litrat', type: 'number' });
    const redundant = field({
      id: 'r',
      key: 'mitta',
      type: 'number',
      print: { when: 'notEmpty', offer: { when: 'notEmpty', group: 'tieto' } },
    });
    const samples = [
      { item: { ...numberField, print: { offer: true as const } }, catalog: formOf(numberField) },
      { item: { ...numberField, print: {} }, catalog: formOf(numberField) },
      { item: paint, catalog: formOf(paint, qty) },
      { item: redundant, catalog: formOf(redundant) },
      { item: boolField, catalog: formOf(boolField) },
    ];

    for (const { item, catalog } of samples) {
      const starting = item.print ? readPrintEditorState(item, catalog) : legacyToExplicitState(item, catalog);
      const once = applyPrintEditorChange(item, catalog, starting);
      const again = readPrintEditorState(once, catalog);
      expect(again).toEqual(starting);
      const twice = applyPrintEditorChange(once, catalog, again);
      expect(twice.print).toEqual(once.print);
      expect(readPrintEditorState(twice, catalog)).toEqual(again);
    }
  });
});

describe('legacy conversion', () => {
  test('boolean showOnSummary becomes offer true and urakkakortti always', () => {
    const form = formOf(boolField);
    expect(writePrintEditorState(legacyToExplicitState(boolField, form), boolField, form)).toEqual({
      offer: true,
      urakkakortti: { when: 'always' },
    });
  });

  test('customer page and euro legacy writes do not add urakkakortti rows', () => {
    const euro = field({ id: 'e', key: 'hinta', type: 'number', unit: '€' });
    const note = field({ id: 'c', key: 'huom', type: 'text' });
    const form = formOf(euro, note);
    form.pages = [
      { id: 'cust', title: 'Asiakas', sortOrder: 0, system: 'customer', fieldIds: ['c'] },
      { id: 'p1', title: 'Sivu', sortOrder: 1, fieldIds: ['e'] },
    ];
    expect(writePrintEditorState(legacyToExplicitState(note, form), note, form)).toEqual({ offer: true });
    expect(writePrintEditorState(legacyToExplicitState(euro, form), euro, form)).toEqual({});
  });

  test('pdf fixture and the bundled default form keep printable rows, except showOnSummaryWhen', () => {
    expect(printableRows(pdfForm)).toEqual(printableRows(convertLegacy(pdfForm)));

    const bundled = normalizeFormDefinition(createDefaultFormDefinition());
    const converted = convertLegacy(bundled);
    const exceptionKeys = new Set(
      bundled.fields.filter((item) => item.showOnSummaryWhen).map((item) => item.key),
    );
    expect(exceptionKeys.size).toBeGreaterThan(0);

    for (const target of ['offer', 'urakkakortti'] as const) {
      const before = printableFields({
        form: bundled,
        fieldValues: {},
        context: {},
        products: [],
        target,
      });
      const after = printableFields({
        form: converted,
        fieldValues: {},
        context: {},
        products: [],
        target,
      });
      const stable = (rows: { key: string }[]) => rows.filter((row) => !exceptionKeys.has(row.key));
      expect(stable(after)).toEqual(stable(before));
      const changed = diffKeys(before, after);
      expect([...changed].every((key) => exceptionKeys.has(key))).toBe(true);
    }

    const offerBefore = printableFields({ form: bundled, fieldValues: {}, context: {}, products: [], target: 'offer' });
    const offerAfter = printableFields({ form: converted, fieldValues: {}, context: {}, products: [], target: 'offer' });
    const cardBefore = printableFields({
      form: bundled,
      fieldValues: {},
      context: {},
      products: [],
      target: 'urakkakortti',
    });
    const cardAfter = printableFields({
      form: converted,
      fieldValues: {},
      context: {},
      products: [],
      target: 'urakkakortti',
    });
    expect(diffKeys(offerBefore, offerAfter).size).toBe(0);
    expect(diffKeys(cardBefore, cardAfter).size).toBeGreaterThan(0);
  });
});

describe('print editor guards', () => {
  test('an untouched legacy field does not gain a print key', () => {
    const item = field({ id: 't', key: 'teksti', type: 'text' });
    const form = formOf(item);
    const before = JSON.stringify(item);
    readPrintEditorState(item, form);
    legacyToExplicitState(item, form);
    printWhenOptions(item);
    expect(JSON.stringify(item)).toBe(before);
    expect(Object.prototype.hasOwnProperty.call(item, 'print')).toBe(false);
    expect(stateForTypeChange(item, { ...item, type: 'number' }, form)).toBeNull();
  });

  test('printWhenOptions never offers ifYes for non-booleans', () => {
    expect(printWhenOptions(boolField)).toEqual(['always', 'notEmpty', 'ifYes']);
    for (const type of ['number', 'text', 'select', 'product_select', 'computed', 'section'] as const) {
      expect(printWhenOptions(field({ id: type, key: type, type }))).toEqual(['always', 'notEmpty']);
    }
  });

  test('canPrintOnUrakkakortti is false only for unit €', () => {
    expect(canPrintOnUrakkakortti(field({ id: 'e', key: 'hinta', type: 'number', unit: '€' }))).toBe(false);
    expect(canPrintOnUrakkakortti(field({ id: 'm', key: 'mitta', type: 'number', unit: 'm²' }))).toBe(true);
    expect(canPrintOnUrakkakortti(textField)).toBe(true);
  });

  test('quantityKeyOptions lists other non-section fields for product_select only', () => {
    const paint = field({ id: 'm', key: 'kaytettava_maali', type: 'product_select', label: 'Maali' });
    const qty = field({ id: 'q', key: 'litrat', type: 'number', label: 'Litrat' });
    const section = field({ id: 's', key: 'otsikko', type: 'section', label: 'Otsikko' });
    const system = field({
      id: 'sys',
      key: 'tyoryhma_kesto_pv',
      type: 'computed',
      systemKey: 'tyoryhma_kesto_pv',
      label: 'Työn kesto',
    });
    const form = formOf(paint, qty, section, system);
    expect(quantityKeyOptions(form, qty)).toEqual([]);
    expect(quantityKeyOptions(form, paint)).toEqual([
      { key: 'litrat', label: 'Litrat' },
      { key: 'tyoryhma_kesto_pv', label: 'Työn kesto' },
    ]);
  });

  test('type change cleans ifYes and quantityKey and leaves a legacy field untouched', () => {
    const paint = field({
      id: 'm',
      key: 'kaytettava_maali',
      type: 'product_select',
      print: { urakkakortti: { group: 'maali', quantityKey: 'litrat' } },
    });
    const qty = field({ id: 'q', key: 'litrat', type: 'number' });
    const catalog = formOf(paint, qty);
    const asNumber = { ...paint, type: 'number' as const };
    const migrated = stateForTypeChange(paint, asNumber, catalog);
    expect(migrated).not.toBeNull();
    expect(applyPrintEditorChange(asNumber, catalog, migrated!).print).toEqual({
      urakkakortti: { group: 'maali' },
    });

    const flagged = field({
      id: 'b',
      key: 'lippu',
      type: 'boolean',
      print: { when: 'ifYes', offer: { when: 'ifYes' } },
    });
    const asText = { ...flagged, type: 'text' as const };
    const flagState = stateForTypeChange(flagged, asText, formOf(flagged));
    expect(applyPrintEditorChange(asText, formOf(flagged), flagState!).print).toEqual({ offer: true });

    const section = field({
      id: 'sec',
      key: 'otsikko',
      type: 'section',
      print: { offer: { when: 'notEmpty' } },
    });
    const asBoolean = { ...section, type: 'boolean' as const };
    const sectionState = stateForTypeChange(section, asBoolean, formOf(section));
    expect(applyPrintEditorChange(asBoolean, formOf(section), sectionState!).print).toEqual({
      offer: { when: 'notEmpty' },
    });
  });
});

function convertLegacy(definition: FormDefinition): FormDefinition {
  return {
    ...definition,
    fields: definition.fields.map((item) => {
      const print = item.print as unknown;
      const explicit = print !== null && typeof print === 'object' && !Array.isArray(print);
      if (explicit) return item;
      return applyPrintEditorChange(item, definition, legacyToExplicitState(item, definition));
    }),
  };
}

function printableRows(definition: FormDefinition) {
  return (['offer', 'urakkakortti'] as const).map((target) =>
    printableFields({
      form: definition,
      fieldValues: { kiintea_seinapinta_ala_m2: '120', laudoitustyyppi: '1.15' },
      context: { kiintea_seinapinta_ala_m2: 120, laudoitustyyppi: 1.15, laskenta_seinapinta_ala_m2: 138 },
      products: [],
      target,
    }),
  );
}

function diffKeys(before: { key: string }[], after: { key: string }[]): Set<string> {
  const beforeKeys = new Set(before.map((row) => row.key));
  const afterKeys = new Set(after.map((row) => row.key));
  const changed = new Set<string>();
  for (const key of beforeKeys) if (!afterKeys.has(key)) changed.add(key);
  for (const key of afterKeys) if (!beforeKeys.has(key)) changed.add(key);
  const afterByKey = new Map(after.map((row) => [row.key, JSON.stringify(row)]));
  for (const row of before) {
    const other = afterByKey.get(row.key);
    if (other !== undefined && other !== JSON.stringify(row)) changed.add(row.key);
  }
  return changed;
}
