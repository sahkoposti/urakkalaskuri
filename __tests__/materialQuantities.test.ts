jest.mock('expo-sqlite', () => ({}));

import type { FormDefinition, FormField } from '../src/core/form/types';
import { parseStructureLines } from '../src/core/database/connection';
import {
  addManualMaterialRow,
  editMaterialQuantity,
  effectiveMaterialQuantities,
  formatQuantity,
  MATERIAL_QUANTITY_MAX,
  materialQuantitiesBlockFinish,
  mergeStructureLineMaterials,
  parseQuantityInput,
  prefillMaterialQuantities,
  removeMaterialRow,
  syncMaterialQuantities,
} from '../src/core/materials/materialQuantities';
import type { FormSnapshot, MaterialQuantityRow, Product, StructureLine } from '../src/core/models/types';
import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import { buildUrakkakorttiContext, urakkakorttiMaterials, type BuildUrakkakorttiInput } from '../src/core/pdf/urakkakortti';
import { withDerivedLinePricing } from '../src/core/structure/linePricing';
import type { ProductStructure } from '../src/core/structure/types';
import { cloneStructureLine } from '../src/core/wizard/wizardDraftHelpers';
import { input, line, record, structure } from './pdfFixtures';
import type { CalculationRecord } from '../src/core/models/types';

const vinha: Product = {
  id: 'vinha',
  name: 'Tikkurila Vinha',
  unit: 'l',
  unitPriceVat0: 12,
  createdAt: new Date(2026, 0, 1),
};

function field(partial: Partial<FormField> & Pick<FormField, 'id' | 'key' | 'type'>): FormField {
  return { label: partial.label ?? partial.key, required: false, showOnSummary: false, ...partial };
}

function formOf(fields: FormField[], fieldIds = fields.map((item) => item.id)): FormDefinition {
  return {
    id: 'paint-form',
    name: 'Maalitesti',
    version: 1,
    updatedAt: 1,
    pages: [{ id: 'tyo', title: 'Työ', sortOrder: 0, fieldIds }],
    fields,
  };
}

const litres = field({
  id: 'litres',
  key: 'maalit_yhteensa_litraa',
  type: 'number',
  label: 'Maalit yhteensä',
  unit: 'litraa',
});

function paintField(print: FormField['print']): FormField {
  return field({
    id: 'paint',
    key: 'kaytettava_maali',
    type: 'product_select',
    label: 'Käytettävä maali',
    print,
  });
}

const paintForm = formOf([
  paintField({ urakkakortti: { group: 'maali', quantityKey: 'maalit_yhteensa_litraa' } }),
  litres,
]);

function snap(fields: FormSnapshot['fields']): FormSnapshot {
  return { formId: 'paint-form', formVersion: 1, fields };
}

function paintLine(extra: Partial<StructureLine> = {}): StructureLine {
  return {
    ...line('l1', 's-paint', 'Ulkomaalaus'),
    fieldValues: { kaytettava_maali: 'vinha', maalit_yhteensa_litraa: '49' },
    snapshot: snap([
      { key: 'kaytettava_maali', label: 'Käytettävä maali', value: 'Tikkurila Vinha' },
      { key: 'maalit_yhteensa_litraa', label: 'Maalit yhteensä', value: '49 litraa', unit: 'litraa' },
    ]),
    ...extra,
  };
}

function formRow(quantity: number, fieldKey = 'kaytettava_maali', id = `form:${fieldKey}`): MaterialQuantityRow {
  return {
    id,
    productId: 'vinha',
    productName: 'Tikkurila Vinha',
    quantity,
    unit: 'litraa',
    source: 'form',
    fieldKey,
  };
}

const manualRow: MaterialQuantityRow = {
  id: 'm1',
  productName: 'Pensseli',
  quantity: 2,
  unit: 'kpl',
  source: 'manual',
};

function ukInput(rec: CalculationRecord, extra: Partial<BuildUrakkakorttiInput> = {}): BuildUrakkakorttiInput {
  const base = input(rec);
  return {
    record: rec,
    company: base.company,
    structures: base.structures,
    products: base.products,
    settings: base.settings,
    generatedAt: new Date(2026, 9, 10),
    ...extra,
  };
}

const bodyOf = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/, '');

describe('prefillMaterialQuantities', () => {
  test('paint field and quantityKey become product, quantity and unit', () => {
    const [row] = prefillMaterialQuantities(paintLine(), paintForm, [vinha]);
    expect(`${row.productName} | ${row.quantity} | ${row.unit}`).toBe('Tikkurila Vinha | 49 | litraa');
    expect(row).toMatchObject({
      productId: 'vinha',
      source: 'form',
      fieldKey: 'kaytettava_maali',
      id: 'form:kaytettava_maali',
    });
  });

  test('snapshot value wins over a recompute', () => {
    const [row] = prefillMaterialQuantities(
      paintLine({
        fieldValues: { kaytettava_maali: 'vinha', maalit_yhteensa_litraa: '10' },
        snapshot: snap([
          { key: 'maalit_yhteensa_litraa', label: 'Maalit', value: '49,0 litraa', unit: 'litraa' },
        ]),
      }),
      paintForm,
      [vinha],
    );
    expect(row.quantity).toBe(49);
  });

  test('recomputes from the formula context when the snapshot has no quantity', () => {
    const [row] = prefillMaterialQuantities(
      paintLine({
        fieldValues: { kaytettava_maali: 'vinha', maalit_yhteensa_litraa: '49' },
        snapshot: snap([{ key: 'kaytettava_maali', label: 'Maali', value: 'Tikkurila Vinha' }]),
      }),
      paintForm,
      [vinha],
    );
    expect(row.quantity).toBe(49);
    expect(row.unit).toBe('litraa');
  });

  test('skips hidden, empty, missing quantityKey and the wrong group', () => {
    const hidden = formOf([
      field({ id: 'show', key: 'nayta', type: 'boolean', label: 'Näytä' }),
      field({
        id: 'paint',
        key: 'kaytettava_maali',
        type: 'product_select',
        showWhen: { fieldKey: 'nayta', operator: 'eq', value: 'true' },
        print: { urakkakortti: { group: 'maali', quantityKey: 'maalit_yhteensa_litraa' } },
      }),
      litres,
    ]);
    expect(
      prefillMaterialQuantities(
        paintLine({ fieldValues: { nayta: 'false', kaytettava_maali: 'vinha', maalit_yhteensa_litraa: '49' } }),
        hidden,
        [vinha],
      ),
    ).toEqual([]);

    expect(
      prefillMaterialQuantities(paintLine({ fieldValues: { kaytettava_maali: '', maalit_yhteensa_litraa: '49' } }), paintForm, [vinha]),
    ).toEqual([]);

    const noKey = formOf([paintField({ urakkakortti: { group: 'maali' } }), litres]);
    expect(prefillMaterialQuantities(paintLine(), noKey, [vinha])).toEqual([]);

    const wrongGroup = formOf([
      paintField({ urakkakortti: { group: 'tieto', quantityKey: 'maalit_yhteensa_litraa' } }),
      litres,
    ]);
    expect(prefillMaterialQuantities(paintLine(), wrongGroup, [vinha])).toEqual([]);
  });

  test('follows form order', () => {
    const second = field({
      id: 'primer',
      key: 'pohjamaali',
      type: 'product_select',
      print: { urakkakortti: { group: 'maali', quantityKey: 'pohjamaali_litraa' } },
    });
    const primerLitres = field({ id: 'pl', key: 'pohjamaali_litraa', type: 'number', unit: 'litraa' });
    const ordered = formOf(
      [paintField({ urakkakortti: { group: 'maali', quantityKey: 'maalit_yhteensa_litraa' } }), second, litres, primerLitres],
      ['primer', 'paint', 'litres', 'pl'],
    );
    const rows = prefillMaterialQuantities(
      paintLine({
        fieldValues: {
          kaytettava_maali: 'vinha',
          maalit_yhteensa_litraa: '49',
          pohjamaali: 'vinha',
          pohjamaali_litraa: '3',
        },
        snapshot: snap([]),
      }),
      ordered,
      [vinha],
    );
    expect(rows.map((row) => row.fieldKey)).toEqual(['pohjamaali', 'kaytettava_maali']);
  });
});

describe('sync, edit, add and remove', () => {
  test('undefined existing returns prefill; manual is kept; form rows refresh; an edited row is not duplicated', () => {
    const prefill = [formRow(49)];
    expect(syncMaterialQuantities(undefined, prefill)).toEqual(prefill);

    const edited: MaterialQuantityRow = { ...formRow(12, 'kaytettava_maali', 'kept'), source: 'manual' };
    const synced = syncMaterialQuantities([manualRow, formRow(1, 'kaytettava_maali', 'old-form')], [formRow(49)]);
    expect(synced.map((row) => row.id)).toEqual(['m1', 'old-form']);
    expect(synced[0]).toEqual(manualRow);
    expect(synced[1].quantity).toBe(49);
    expect(synced[1].source).toBe('form');

    const suppressed = syncMaterialQuantities([edited, manualRow], [formRow(49)]);
    expect(suppressed).toHaveLength(2);
    expect(suppressed.filter((row) => row.fieldKey === 'kaytettava_maali')).toEqual([edited]);
    expect(suppressed.map((row) => row.source)).toEqual(['manual', 'manual']);
  });

  test('edit, add and remove do not mutate the previous array', () => {
    const rows = [formRow(49)];
    const edited = editMaterialQuantity(rows, rows[0].id, { quantity: 12, productName: 'Oma sävy' });
    expect(rows[0]).toMatchObject({ quantity: 49, source: 'form', productName: 'Tikkurila Vinha' });
    expect(edited[0]).toMatchObject({
      quantity: 12,
      productName: 'Oma sävy',
      source: 'manual',
      fieldKey: 'kaytettava_maali',
      id: rows[0].id,
    });

    const added = addManualMaterialRow(rows);
    expect(rows).toHaveLength(1);
    expect(added).toHaveLength(2);
    expect(added[1]).toMatchObject({ productName: '', quantity: 0, source: 'manual' });
    expect(added[1].id).not.toBe(rows[0].id);

    const removed = removeMaterialRow(added, added[1].id);
    expect(added).toHaveLength(2);
    expect(removed).toHaveLength(1);
    expect(removed[0].productName).toBe('Tikkurila Vinha');
  });

  test('merge keeps a missing key until the form changes, then stores the prefill', () => {
    const previous = paintLine();
    const same = paintLine({ name: 'Uusi nimi' });
    expect(mergeStructureLineMaterials(previous, same, paintForm, [vinha]).materialQuantities).toBeUndefined();

    const changed = paintLine({ fieldValues: { kaytettava_maali: 'vinha', maalit_yhteensa_litraa: '10' } });
    expect(mergeStructureLineMaterials(previous, changed, paintForm, [vinha]).materialQuantities?.[0].quantity).toBe(49);

    const plain = line('l1', 's1', 'Ulkomaalaus');
    const plainChanged = { ...plain, fieldValues: { kiintea_seinapinta_ala_m2: '10' } };
    expect(mergeStructureLineMaterials(plain, plainChanged, paintForm, [vinha]).materialQuantities).toBeUndefined();
  });
});

describe('parseQuantityInput', () => {
  test.each([
    ['49', 49],
    ['49,5', 49.5],
    ['49.5', 49.5],
    ['49,50', 49.5],
    ['  49 ', 49],
    ['0,5', 0.5],
    ['100000', MATERIAL_QUANTITY_MAX],
    ['100000,00', MATERIAL_QUANTITY_MAX],
  ])('accepts %j', (text, expected) => {
    expect(parseQuantityInput(text)).toBe(expected);
  });

  test.each(['45abc', '1e3', '1 000', '1\u00a0000', '-1', '0', '0,0', '', '   ', 'NaN', '1,234', '100001', '+49', '49.'])(
    'rejects %j',
    (text) => {
      expect(parseQuantityInput(text)).toBeNull();
    },
  );

  test('formats with a Finnish comma and without a thousands separator', () => {
    expect(formatQuantity(49.5)).toBe('49,5');
    expect(formatQuantity(49)).toBe('49');
    expect(formatQuantity(100000)).toBe('100000');
  });
});

describe('structure line JSON', () => {
  test('round-trip keeps rows and drops malformed ones', () => {
    const stored = withDerivedLinePricing(paintLine());
    stored.materialQuantities = [
      formRow(49),
      { id: 'bad-name', productName: 12, quantity: 1, source: 'manual' } as unknown as MaterialQuantityRow,
      { id: 'zero', productName: 'Nolla', quantity: 0, source: 'manual' },
      { id: 'text-qty', productName: 'Teksti', quantity: '49' as unknown as number, source: 'manual' },
      { id: 'negative', productName: 'Miinus', quantity: -1, source: 'form' },
    ];
    const parsed = parseStructureLines(JSON.stringify([stored]));
    expect(parsed?.[0].materialQuantities).toEqual([formRow(49)]);
  });

  test('an old JSON string without the key stays undefined and re-serializes identically', () => {
    const stored = withDerivedLinePricing(line('l1', 's1', 'Ulkomaalaus')) as StructureLine & { futureFlag: string };
    stored.futureFlag = 'säilyy';
    const raw = JSON.stringify([stored]);
    expect(raw).not.toContain('materialQuantities');
    const parsed = parseStructureLines(raw);
    expect(parsed?.[0].materialQuantities).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(parsed?.[0], 'materialQuantities')).toBe(false);
    expect((parsed?.[0] as { futureFlag?: string }).futureFlag).toBe('säilyy');
    expect(JSON.stringify(parsed)).toBe(raw);
  });

  test('cloneStructureLine copies the quantity rows', () => {
    const stored = paintLine({ materialQuantities: [formRow(49)] });
    const cloned = cloneStructureLine(stored);
    cloned.materialQuantities![0].productName = 'Muu';
    expect(stored.materialQuantities?.[0].productName).toBe('Tikkurila Vinha');
  });
});

describe('effective quantities block an unfinished summary', () => {
  test('defined rows win, including an empty list; otherwise prefill', () => {
    expect(effectiveMaterialQuantities(paintLine(), paintForm, [vinha])[0].quantity).toBe(49);
    expect(effectiveMaterialQuantities(paintLine({ materialQuantities: [] }), paintForm, [vinha])).toEqual([]);
    expect(effectiveMaterialQuantities(paintLine({ materialQuantities: [manualRow] }), paintForm, [vinha])).toEqual([
      manualRow,
    ]);
  });

  test('empty name or non-positive quantity blocks finish; a missing key does not', () => {
    expect(materialQuantitiesBlockFinish(undefined)).toBe(false);
    expect(materialQuantitiesBlockFinish([])).toBe(false);
    expect(materialQuantitiesBlockFinish([formRow(49)])).toBe(false);
    expect(materialQuantitiesBlockFinish([{ ...manualRow, productName: '  ' }])).toBe(true);
    expect(materialQuantitiesBlockFinish([{ ...manualRow, quantity: 0 }])).toBe(true);
  });
});

describe('urakkakortti material table', () => {
  const paintStructure: ProductStructure = { ...structure('s-paint', 'Ulkomaalaus'), form: paintForm };

  test('saved rows are shown for one line and prefixed when there are several', () => {
    const single = record(
      {},
      { lines: [], structureLines: [paintLine({ materialQuantities: [formRow(49.5)] })] },
    );
    const singleHtml = bodyOf(renderUrakkakorttiHtml(buildUrakkakorttiContext(ukInput(single, {
      structures: [paintStructure],
      products: [vinha],
    }))));
    expect(singleHtml).toContain('<td>Tikkurila Vinha</td><td class="value">49,5</td><td>litraa</td>');
    const materials = singleHtml.match(/<div class="uk-materials">[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(materials).not.toContain('€');

    const multi = record(
      {},
      {
        lines: [],
        structureLines: [
          paintLine({ id: 'a', name: 'Ulkomaalaus', materialQuantities: [formRow(49)] }),
          {
            ...line('b', 's2', 'Sokkeli'),
            materialQuantities: [{ id: 'p', productName: 'Pohjuste', quantity: 3, unit: 'l', source: 'manual' }],
          },
        ],
      },
    );
    const multiHtml = bodyOf(renderUrakkakorttiHtml(buildUrakkakorttiContext(ukInput(multi, { products: [vinha] }))));
    expect(multiHtml).toContain('Ulkomaalaus: Tikkurila Vinha');
    expect(multiHtml).toContain('Sokkeli: Pohjuste');
    expect(multiHtml).toContain('>3<');
  });

  test('an empty saved list prints no table, even when legacy lines exist', () => {
    const rec = record(
      {},
      {
        lines: [{ id: 'm1', productName: 'Maali X', unit: 'l', unitPriceVat0: 12.34, quantity: 18.5, lineTotalVat0: 228.29 }],
        structureLines: [paintLine({ materialQuantities: [] })],
      },
    );
    const html = bodyOf(renderUrakkakorttiHtml(buildUrakkakorttiContext(ukInput(rec, { structures: [paintStructure], products: [vinha] }))));
    expect(html).not.toContain('Materiaalit');
    expect(html).not.toContain('Maali X');
  });

  test('an old record without the key prefills in the helper and leaves the T9 table unchanged', () => {
    const prefilled = effectiveMaterialQuantities(paintLine(), paintForm, [vinha]);
    expect(prefilled[0].productName).toBe('Tikkurila Vinha');

    const legacyLines = [{ id: 'm1', productName: 'Maali X', unit: 'l', unitPriceVat0: 12.34, quantity: 18.5, lineTotalVat0: 228.29 }];
    const rec = record({}, { lines: legacyLines, structureLines: [paintLine()] });
    const source = ukInput(rec, { structures: [paintStructure], products: [vinha] });
    const ctx = buildUrakkakorttiContext(source);
    expect(ctx.materials).toEqual(urakkakorttiMaterials(rec));
    expect(ctx.sections[0].paints).toContain('Tikkurila Vinha 49 litraa');
    expect(bodyOf(renderUrakkakorttiHtml(ctx))).toContain('<td>Maali X</td><td class="value">18,5</td><td>l</td>');
  });

  test('no saved rows and no legacy lines keep the table absent', () => {
    const rec = record({}, { lines: [], structureLines: [line('l1', 's1', 'Ulkomaalaus')] });
    const html = bodyOf(renderUrakkakorttiHtml(buildUrakkakorttiContext(ukInput(rec))));
    expect(html).not.toContain('Materiaalit');
    expect(buildUrakkakorttiContext(ukInput(rec)).materials).toEqual([]);
  });

  test('saved rows are the only quantity: the maali line drops the quantityKey amount', () => {
    const rec = record({}, { structureLines: [paintLine({ materialQuantities: [formRow(49)] })] });
    const ctx = buildUrakkakorttiContext(ukInput(rec, { structures: [paintStructure], products: [vinha] }));
    expect(ctx.sections[0].paints).toEqual(['Tikkurila Vinha']);
    expect(ctx.materials).toEqual([{ product: 'Tikkurila Vinha', quantity: '49', unit: 'litraa' }]);
    expect(ctx.sections[0].paints.join(' ')).not.toContain('€');
  });

  test('a euro row is left out of the table', () => {
    const rec = record(
      {},
      {
        structureLines: [
          paintLine({
            materialQuantities: [
              { id: 'e', productName: 'Maali €', quantity: 2, unit: 'l', source: 'manual' },
              formRow(49),
            ],
          }),
        ],
      },
    );
    const html = bodyOf(
      renderUrakkakorttiHtml(buildUrakkakorttiContext(ukInput(rec, { structures: [paintStructure], products: [vinha] }))),
    );
    const materials = html.match(/<div class="uk-materials">[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(materials).toContain('Tikkurila Vinha');
    expect(materials).not.toContain('€');
  });
});

describe('offer HTML', () => {
  test('does not change when a line has materialQuantities', () => {
    const baseLine = line('l1', 's1', 'Ulkomaalaus');
    const withRows = { ...baseLine, materialQuantities: [formRow(49)] };
    const plain = renderTarjousHtml(buildPdfContext(input(record({}, { structureLines: [baseLine] }))));
    const quantified = renderTarjousHtml(buildPdfContext(input(record({}, { structureLines: [withRows] }))));
    expect(quantified).toBe(plain);
  });
});
