import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import {
  addManualMaterialRow,
  editMaterialQuantity,
  removeMaterialRow,
} from '../src/core/materials/materialQuantities';
import {
  mapMaterialEdit,
  mergeMaterialRows,
  mergedMaterialsForLines,
  moveMaterialRow,
  type MaterialRowSource,
} from '../src/core/materials/mergeMaterialRows';
import type { MaterialQuantityRow, StructureLine } from '../src/core/models/types';
import { input, line, record } from './pdfFixtures';

function row(partial: Partial<MaterialQuantityRow> & Pick<MaterialQuantityRow, 'id' | 'productName' | 'quantity'>): MaterialQuantityRow {
  return { source: 'manual', ...partial };
}

function source(lineId: string, lineName: string, item: MaterialQuantityRow): MaterialRowSource {
  return { lineId, lineName, row: item };
}

function withRows(id: string, name: string, rows: MaterialQuantityRow[]): StructureLine {
  return { ...line(id, 's1', name), materialQuantities: rows };
}

describe('mergeMaterialRows', () => {
  test('merges by productId and sums quantities and shades', () => {
    const merged = mergeMaterialRows([
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
    const merged = mergeMaterialRows([
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
    const merged = mergeMaterialRows([
      source('l1', 'A', row({ id: 'a', productId: 'p1', productName: '  ', quantity: 1, unit: 'l' })),
      source('l1', 'A', row({ id: 'b', productId: 'p1', productName: '', quantity: 1, unit: 'l' })),
      source('l2', 'B', row({ id: 'c', productName: 'Maali', quantity: 4, unit: 'l' })),
    ]);
    expect(merged).toHaveLength(3);
    expect(merged.map((item) => item.contributions.map((contribution) => contribution.rowId))).toEqual([['a'], ['b'], ['c']]);
  });

  test('a name without productId does not merge into a productId row', () => {
    const merged = mergeMaterialRows([
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
    const group = mergeMaterialRows([
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

  test('urakkakortti still prints each structure line, not the merged total', () => {
    const lines = [
      withRows('l1', 'Seinä', [row({ id: 'a', productName: 'Maali', quantity: 2, unit: 'l' })]),
      withRows('l2', 'Sokkeli', [row({ id: 'b', productName: 'Maali', quantity: 3, unit: 'l' })]),
    ];
    const html = renderUrakkakorttiHtml(
      buildUrakkakorttiContext({
        ...input(record({}, { structureLines: lines })),
        record: record({}, { structureLines: lines }),
      }),
    );
    expect(html).toContain('Seinä');
    expect(html).toContain('Sokkeli');
    expect(html).toContain('>2 l<');
    expect(html).toContain('>3 l<');
    expect(html).not.toContain('>5 l<');
  });
});
