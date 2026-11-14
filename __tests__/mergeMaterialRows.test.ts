import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { buildOfferRows, buildOfferSections } from '../src/core/pdf/offerDocument';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import { parseStructureLines } from '../src/core/database/rowParsers';
import {
  addManualMaterialRow,
  editMaterialQuantity,
  removeMaterialRow,
} from '../src/core/materials/materialQuantities';
import {
  mapMaterialEdit,
  mergeLineMaterials,
  mergeMaterialRows,
  mergedMaterialsForLines,
  moveMaterialRow,
  type MaterialRowSource,
  type MergedMaterialRow,
} from '../src/core/materials/mergeMaterialRows';
import type { MaterialQuantityRow, StructureLine } from '../src/core/models/types';
import { input, line, record } from './pdfFixtures';

function row(partial: Partial<MaterialQuantityRow> & Pick<MaterialQuantityRow, 'id' | 'productName' | 'quantity'>): MaterialQuantityRow {
  return { source: 'manual', ...partial };
}

function source(
  lineId: string,
  lineName: string,
  item: MaterialQuantityRow,
  lineQuantity?: number,
): MaterialRowSource {
  return { lineId, lineName, lineQuantity, row: item };
}

function withRows(id: string, name: string, rows: MaterialQuantityRow[]): StructureLine {
  return { ...line(id, 's1', name), materialQuantities: rows };
}

describe('mergeMaterialRows', () => {
  test('merges by productId and sums quantities and shades', () => {
    const merged = mergeLineMaterials([
      source('l1', 'Seinä', row({
        id: 'a',
        productId: 'p1',
        productName: 'Nova',
        quantity: 2,
        unit: 'l',
        shades: [
          { id: 's1', name: 'G47', quantity: 3, unit: 'l' },
          { id: 's2', name: 'NCS', quantity: 1, unit: 'kpl' },
        ],
      })),
      source('l2', 'Sokkeli', row({
        id: 'b',
        productId: 'p1',
        productName: 'Eri nimi',
        quantity: 4,
        unit: 'L',
        shades: [{ id: 's3', name: ' g47 ', quantity: 2, unit: 'L' }],
      })),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      productId: 'p1',
      productName: 'Nova',
      quantity: 6,
      unit: 'l',
    });
    expect(merged[0].contributions).toEqual([
      { lineId: 'l1', lineName: 'Seinä', rowId: 'a', quantity: 2 },
      { lineId: 'l2', lineName: 'Sokkeli', rowId: 'b', quantity: 4 },
    ]);
    expect(merged[0].shades.map((shade) => ({ name: shade.name, unit: shade.unit, quantity: shade.quantity }))).toEqual([
      { name: 'G47', unit: 'l', quantity: 5 },
      { name: 'NCS', unit: 'kpl', quantity: 1 },
    ]);
  });

  test('merges name case and whitespace, and keeps a different unit apart', () => {
    const merged = mergeLineMaterials([
      source('l1', 'A', row({ id: 'a', productName: ' Maali ', quantity: 1, unit: 'l' })),
      source('l2', 'B', row({ id: 'b', productName: 'maali', quantity: 2, unit: 'L' })),
      source('l3', 'C', row({ id: 'c', productName: 'Maali', quantity: 9, unit: 'kg' })),
    ]);
    expect(merged.map((item) => ({ name: item.productName, unit: item.unit, quantity: item.quantity, n: item.contributions.length }))).toEqual([
      { name: ' Maali ', unit: 'l', quantity: 3, n: 2 },
      { name: 'Maali', unit: 'kg', quantity: 9, n: 1 },
    ]);
  });

  test('empty names never merge, even with the same productId', () => {
    const merged = mergeLineMaterials([
      source('l1', 'A', row({ id: 'a', productId: 'p1', productName: '  ', quantity: 1, unit: 'l' })),
      source('l1', 'A', row({ id: 'b', productId: 'p1', productName: '', quantity: 1, unit: 'l' })),
      source('l2', 'B', row({ id: 'c', productName: 'Maali', quantity: 4, unit: 'l' })),
    ]);
    expect(merged).toHaveLength(3);
    expect(merged.map((item) => item.contributions.map((contribution) => contribution.rowId))).toEqual([['a'], ['b'], ['c']]);
  });

  test('a name without productId does not merge into a productId row', () => {
    const merged = mergeLineMaterials([
      source('l1', 'A', row({ id: 'a', productId: 'p1', productName: 'Maali', quantity: 1, unit: 'l' })),
      source('l2', 'B', row({ id: 'b', productName: 'Maali', quantity: 2, unit: 'l' })),
    ]);
    expect(merged).toHaveLength(2);
  });

  test('single and multi edits map back onto the stored line rows', () => {
    const lines = [
      withRows('l1', 'Seinä', [row({ id: 'a', productId: 'p1', productName: 'Maali', quantity: 2, unit: 'l', source: 'form', fieldKey: 'maali' })]),
      withRows('l2', 'Sokkeli', [row({ id: 'b', productId: 'p1', productName: 'Maali', quantity: 3, unit: 'l', source: 'form', fieldKey: 'maali' })]),
    ];
    const group = mergeLineMaterials([
      source('l1', 'Seinä', lines[0].materialQuantities![0]),
      source('l2', 'Sokkeli', lines[1].materialQuantities![0]),
    ])[0];

    const one = mapMaterialEdit(
      [lines[0]],
      [{ lineId: 'l1', rowId: 'a' }],
      (rows, rowId) => editMaterialQuantity(rows, rowId, { quantity: 8 }),
      (item) => item.materialQuantities ?? [],
    );
    expect(one[0].materialQuantities?.[0]).toMatchObject({ quantity: 8, source: 'manual', fieldKey: 'maali' });
    expect(lines[0].materialQuantities?.[0].quantity).toBe(2);

    const renamed = mapMaterialEdit(
      lines,
      group.contributions,
      (rows, rowId) => editMaterialQuantity(rows, rowId, { productName: 'Vaha', unit: 'kg' }),
      (item) => item.materialQuantities ?? [],
    );
    expect(renamed.map((item) => item.materialQuantities?.[0])).toMatchObject([
      { productName: 'Vaha', unit: 'kg', source: 'manual' },
      { productName: 'Vaha', unit: 'kg', source: 'manual' },
    ]);

    const removed = mapMaterialEdit(
      lines,
      group.contributions,
      (rows, rowId) => removeMaterialRow(rows, rowId),
      (item) => item.materialQuantities ?? [],
    );
    expect(removed.map((item) => item.materialQuantities)).toEqual([[], []]);
  });

  test('manual row is stored on the only line, and can be moved off the last line', () => {
    const only = withRows('l1', 'Seinä', []);
    const added = addManualMaterialRow(only.materialQuantities ?? []);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ source: 'manual', productName: '', quantity: 0 });
    const stored = { ...only, materialQuantities: added };
    expect(stored.id).toBe('l1');

    const two = [
      withRows('l1', 'Seinä', []),
      withRows('l2', 'Sokkeli', [row({ id: 'new', productName: '', quantity: 0 })]),
    ];
    const moved = moveMaterialRow(two, 'l2', 'new', 'l1', (item) => item.materialQuantities ?? []);
    expect(moved[0].materialQuantities?.map((item) => item.id)).toEqual(['new']);
    expect(moved[1].materialQuantities).toEqual([]);
    expect(two[1].materialQuantities?.map((item) => item.id)).toEqual(['new']);
  });

  test('loading saved rows does not rewrite materialQuantities', () => {
    const saved: MaterialQuantityRow[] = [row({ id: 'kept', productName: 'Maali', quantity: 4, unit: 'l' })];
    const lines = [withRows('l1', 'Seinä', saved), withRows('l2', 'Sokkeli', saved.map((item) => ({ ...item, id: 'kept-2', quantity: 1 })))];
    const merged = mergedMaterialsForLines(lines.map((item) => ({ line: item })), []);
    expect(lines[0].materialQuantities).toBe(saved);
    expect(lines[1].materialQuantities).toEqual([row({ id: 'kept-2', productName: 'Maali', quantity: 1, unit: 'l' })]);
    expect(merged[0].quantity).toBe(5);
    expect(merged[0].contributions).toHaveLength(2);
  });

  test('keeps first-appearance order', () => {
    const merged = mergeLineMaterials([
      source('l1', 'A', row({ id: 'b', productName: 'Pensseli', quantity: 1, unit: 'kpl' })),
      source('l2', 'B', row({ id: 'a', productName: 'Maali', quantity: 2, unit: 'l' })),
      source('l2', 'B', row({ id: 'c', productName: 'pensseli', quantity: 4, unit: 'KPL' })),
    ]);
    expect(merged.map((item) => item.productName)).toEqual(['Pensseli', 'Maali']);
    expect(merged[0].quantity).toBe(5);
  });

  test('mergeMaterialRows is the same function', () => {
    expect(mergeMaterialRows).toBe(mergeLineMaterials);
  });
});

function printableProjection(groups: MergedMaterialRow[]) {
  return groups
    .filter((group) => group.productName.trim())
    .map((group) => {
      const shades = group.shades.filter((shade) => shade.name.trim() && shade.quantity > 0);
      return {
        product: group.productName.trim(),
        unit: shades.length === 0 ? (group.unit ?? '').trim().toLowerCase() : '',
        quantity: shades.length === 0 ? group.quantity : 0,
        shades: shades.map((shade) => ({
          name: shade.name.trim().toLowerCase(),
          unit: (shade.unit ?? '').trim().toLowerCase(),
          quantity: shade.quantity,
        })),
      };
    });
}

function pdfProjection(rows: { product: string; quantity: string; unit: string; shadeHeader?: boolean; shade?: boolean; structureHeader?: boolean }[]) {
  expect(rows.some((row) => row.structureHeader)).toBe(false);
  const groups: {
    product: string;
    unit: string;
    quantity: number;
    shades: { name: string; unit: string; quantity: number }[];
  }[] = [];
  for (const row of rows) {
    if (row.shade) {
      groups.at(-1)?.shades.push({
        name: row.product.trim().toLowerCase(),
        unit: row.unit.trim().toLowerCase(),
        quantity: Number(row.quantity.replace(',', '.')),
      });
      continue;
    }
    groups.push({
      product: row.product.trim(),
      unit: row.shadeHeader ? '' : row.unit.trim().toLowerCase(),
      quantity: row.shadeHeader ? 0 : Number(row.quantity.replace(',', '.')),
      shades: [],
    });
  }
  return groups;
}

describe('screen and urakkakortti PDF share mergeLineMaterials', () => {
  const lines = [
    withRows('l1', 'Seinä', [
      row({
        id: 'a',
        productId: 'p1',
        productName: 'Nova',
        quantity: 2,
        unit: 'l',
        shades: [
          { id: 's1', name: 'G47', quantity: 3, unit: 'l' },
          { id: 's2', name: 'NCS', quantity: 1, unit: 'kpl' },
        ],
      }),
      row({ id: 'brush', productName: 'Pensseli', quantity: 1, unit: 'kpl' }),
    ]),
    withRows('l2', 'Sokkeli', [
      row({
        id: 'b',
        productId: 'p1',
        productName: 'Eri nimi',
        quantity: 4,
        unit: 'L',
        shades: [{ id: 's3', name: ' g47 ', quantity: 2, unit: 'L' }],
      }),
      row({ id: 'c', productName: 'Maali', quantity: 9, unit: 'kg' }),
      row({ id: 'empty', productName: '  ', quantity: 1, unit: 'l' }),
    ]),
  ];

  test('view-model sums match the PDF table for the same lines', () => {
    const screen = mergedMaterialsForLines(lines.map((item) => ({ line: item })), []);
    const ctx = buildUrakkakorttiContext(input(record({}, { structureLines: lines })));
    expect(pdfProjection(ctx.materials)).toEqual(printableProjection(screen));
    expect(screen.some((group) => !group.productName.trim())).toBe(true);
    expect(ctx.materials.map((row) => row.product)).not.toContain('Seinä');
    expect(ctx.materials.map((row) => row.product)).not.toContain('Sokkeli');
  });

  test('merged rows print the product name only, and a single line stays unprefixed', () => {
    const html = renderUrakkakorttiHtml(buildUrakkakorttiContext(input(record({}, { structureLines: lines }))));
    const materials = html.slice(html.indexOf('class="uk-materials'));
    expect(materials).toContain('>5 l<');
    expect(materials).not.toContain('>2 l<');
    expect(materials).not.toContain('>3 l<');
    expect(materials).not.toContain('Seinä:');
    expect(materials).not.toContain('Sokkeli:');
    expect(materials).not.toContain('uk-structure');
    expect(materials).toContain('Nova');
    expect(materials).not.toContain('Eri nimi');

    const single = [lines[0]];
    const singleCtx = buildUrakkakorttiContext(input(record({}, { structureLines: single })));
    expect(singleCtx.materials.map((row) => `${row.product}|${row.quantity}|${row.unit}|${row.shadeHeader ?? ''}|${row.shade ?? ''}|${row.structureHeader ?? ''}`)).toEqual([
      'Nova|||true||',
      'G47|3|l||true|',
      'NCS|1|kpl||true|',
      'Pensseli|1|kpl|||',
    ]);
  });
});

describe('quantity 0 stays out of the urakkakortti and the merged materials', () => {
  const zeroRows = [row({ id: 'z', productId: 'p1', productName: 'Piilomaali', quantity: 4, unit: 'l' })];
  const keptRows = [
    row({ id: 'a', productId: 'p1', productName: 'Piilomaali', quantity: 3, unit: 'l' }),
    row({ id: 'b', productName: 'Pensseli', quantity: 1, unit: 'kpl' }),
  ];

  function zeroLine(): StructureLine {
    return {
      ...withRows('z', 'Nollarivi', zeroRows),
      quantity: 0,
      additionalInfo: 'Nollan lisatieto',
      unitPriceVat0: 999,
      contractPriceVat0: 999,
    };
  }

  function keptLine(): StructureLine {
    return {
      ...withRows('a', 'Seinä', keptRows),
      quantity: 2,
      additionalInfo: 'Seinan lisatieto',
    };
  }

  test('only numeric 0 is excluded; NaN, empty and other numbers stay', () => {
    const nanLine = {
      ...withRows('n', 'Rikkinainen', [row({ id: 'n', productName: 'Maali', quantity: 1, unit: 'l' })]),
      quantity: Number.NaN,
    };
    const unset = withRows('u', 'TyhjaMaara', [row({ id: 'u', productName: 'Maali', quantity: 2, unit: 'l' })]);
    delete (unset as { quantity?: number }).quantity;
    const merged = mergeLineMaterials([
      source('n', 'Rikkinainen', nanLine.materialQuantities![0], nanLine.quantity),
      source('u', 'TyhjaMaara', unset.materialQuantities![0], unset.quantity),
      source('z', 'Nollarivi', zeroRows[0], 0),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(3);
    expect(merged[0].contributions.map((item) => item.lineId)).toEqual(['n', 'u']);
  });

  test('a zero line is left out of the sums and the job card, and a non-zero line is not', () => {
    const lines = [zeroLine(), keptLine()];
    const screen = mergedMaterialsForLines(lines.map((line) => ({ line })), []);
    expect(screen.map((item) => ({ name: item.productName, quantity: item.quantity, lines: item.contributions.map((item) => item.lineId) }))).toEqual([
      { name: 'Piilomaali', quantity: 3, lines: ['a'] },
      { name: 'Pensseli', quantity: 1, lines: ['a'] },
    ]);

    const both = [
      { ...keptLine(), id: 'a2', quantity: 4, materialQuantities: [row({ id: 'c', productId: 'p1', productName: 'Piilomaali', quantity: 6, unit: 'l' })] },
      keptLine(),
    ];
    expect(mergedMaterialsForLines(both.map((line) => ({ line })), [])[0].quantity).toBe(9);

    const rec = record({}, { structureLines: lines });
    const before = JSON.stringify(rec);
    const ctx = buildUrakkakorttiContext(input(rec));
    expect(JSON.stringify(rec)).toBe(before);
    expect(pdfProjection(ctx.materials)).toEqual(printableProjection(screen));
    expect(ctx.contractRows.map((row) => row.label)).not.toContain('Urakka: Nollarivi');
    expect(ctx.sections.map((section) => section.title)).not.toContain('Nollarivi');
    expect(ctx.structureLisatiedot).toBe('Seinan lisatieto');
    const html = renderUrakkakorttiHtml(ctx);
    expect(html).not.toContain('Nollarivi');
    expect(html).not.toContain('Nollan lisatieto');
    expect(html).not.toContain('>4 l<');
    expect(html).not.toContain('>7 l<');
    expect(html).toContain('>3 l<');
    expect(html).toContain('Pensseli');
    expect(html).toContain('Seinä');
  });

  test('save and load keep the zero line and its materials', () => {
    const lines = [zeroLine(), keptLine()];
    const loaded = parseStructureLines(JSON.stringify(lines));
    expect(loaded?.map((line) => ({ id: line.id, quantity: line.quantity, materials: line.materialQuantities }))).toEqual([
      { id: 'z', quantity: 0, materials: zeroRows },
      { id: 'a', quantity: 2, materials: keptRows },
    ]);
  });

  test('the offer PDF still follows its own zero-quantity rules', () => {
    const zero = { ...line('z', 's1', 'Nollarivi'), quantity: 0, unitPriceVat0: 999, contractPriceVat0: 999 };
    const kept = line('a', 's1', 'Seinä');
    const withZero = input(record({}, { structureLines: [zero, kept] }));
    const without = input(record({}, { structureLines: [kept] }));
    expect(buildOfferRows(withZero).map((row) => row.name)).toEqual(['Seinä']);
    expect(buildPdfContext(withZero).price).toEqual(buildPdfContext(without).price);
    const zeroSection = buildOfferSections(withZero).find((section) => section.title === 'Nollarivi');
    if (zeroSection) expect(zeroSection.heading).toBeUndefined();
    const html = renderTarjousHtml(buildPdfContext(withZero));
    expect(html).not.toContain('999');
    expect(html).not.toContain('<td class="offer-line-title">Nollarivi</td>');
  });
});
