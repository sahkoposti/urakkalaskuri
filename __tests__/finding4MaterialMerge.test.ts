import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import {
  mergeLineMaterials,
  mergedMaterialDetailRows,
  mergedMaterialsForLines,
  type MaterialRowSource,
  type MergedMaterialRow,
} from '../src/core/materials/mergeMaterialRows';
import type { MaterialQuantityRow, StructureLine } from '../src/core/models/types';
import { input, line, record } from './pdfFixtures';

function materialRow(
  partial: Partial<MaterialQuantityRow> & Pick<MaterialQuantityRow, 'id' | 'productName' | 'quantity'>,
): MaterialQuantityRow {
  return { source: 'manual', unit: 'l', ...partial };
}

function withMaterials(id: string, structureId: string, name: string, rows: MaterialQuantityRow[]): StructureLine {
  return { ...line(id, structureId, name), materialQuantities: rows };
}

function source(
  lineId: string,
  lineName: string,
  item: MaterialQuantityRow,
  lineQuantity?: number,
): MaterialRowSource {
  return { lineId, lineName, lineQuantity, row: item };
}

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

function pdfProjection(
  rows: { product: string; quantity: string; unit: string; shadeHeader?: boolean; shade?: boolean }[],
) {
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

const NOVA_ID = 'p-nova-7';

describe('Finding 4: shared material merge (screen, PDF, detail)', () => {
  const seinä = withMaterials('l1', 's1', 'Seinä', [
    materialRow({ id: 'a', productId: NOVA_ID, productName: 'Nova 7', quantity: 5, unit: 'l' }),
    materialRow({ id: 'b', productId: NOVA_ID, productName: 'Nova 7', quantity: 3, unit: 'l' }),
  ]);
  const sokkeli = withMaterials('l2', 's2', 'Sokkeli', [
    materialRow({ id: 'c', productId: NOVA_ID, productName: 'Nova 7', quantity: 2, unit: 'l' }),
  ]);
  const entries = [seinä, sokkeli].map((item) => ({ line: item }));

  test('audit repro: Nova 7 → 10 l; screen, PDF and detail match; shades and units', () => {
    const screen = mergedMaterialsForLines(entries, []);
    expect(screen).toHaveLength(1);
    expect(screen[0].productName).toBe('Nova 7');
    expect(screen[0].quantity).toBe(10);
    expect(screen[0].contributions).toHaveLength(3);

    const detail = mergedMaterialDetailRows(entries, []);
    expect(detail).toEqual([{ productName: 'Nova 7', value: '10 l', shades: [] }]);

    const ctx = buildUrakkakorttiContext(input(record({}, { structureLines: [seinä, sokkeli] })));
    expect(pdfProjection(ctx.materials)).toEqual(printableProjection(screen));

    const shades = mergeLineMaterials([
      source('l1', 'Seinä', materialRow({
        id: 'x',
        productId: NOVA_ID,
        productName: 'Nova 7',
        quantity: 1,
        shades: [
          { id: 's1', name: 'G47', quantity: 2, unit: 'l' },
          { id: 's2', name: 'G47', quantity: 3, unit: 'l' },
          { id: 's3', name: 'NCS', quantity: 4, unit: 'l' },
        ],
      })),
    ]);
    expect(shades[0].shades.map((item) => ({ name: item.name, quantity: item.quantity }))).toEqual([
      { name: 'G47', quantity: 5 },
      { name: 'NCS', quantity: 4 },
    ]);

    const units = mergeLineMaterials([
      source('l1', 'A', materialRow({ id: 'kg', productName: 'Nova 7', quantity: 1, unit: 'kg' })),
      source('l2', 'B', materialRow({ id: 'l', productName: 'Nova 7', quantity: 2, unit: 'l' })),
    ]);
    expect(units).toHaveLength(2);
    expect(units.map((item) => [item.unit, item.quantity])).toEqual([
      ['kg', 1],
      ['l', 2],
    ]);
  });
});