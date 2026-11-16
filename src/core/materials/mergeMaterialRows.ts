import {
  effectiveMaterialQuantities,
  formatQuantity,
  prefillMaterialQuantities,
  removeMaterialRow,
} from '@/src/core/materials/materialQuantities';
import { structureLineQuantityIsZero } from '@/src/core/materials/structureLineQuantity';
import { scaleByLineQuantity } from '@/src/core/structure/lineQuantityScale';
import type { FormDefinition } from '@/src/core/form/types';
import type { MaterialQuantityRow, MaterialShade, Product, StructureLine } from '@/src/core/models/types';

export type MaterialRowSource = {
  lineId: string;
  lineName: string;
  /**
   * Rakenteen Määrä. Kertoo tuotteen ja sävyjen määrät.
   * Tasan 0 jää yhdistelmästä pois. Puuttuva arvo on yksi kappale.
   */
  lineQuantity?: number;
  row: MaterialQuantityRow;
};

export type MaterialContribution = {
  lineId: string;
  lineName: string;
  rowId: string;
  quantity: number;
};

export type MergedShadeContribution = {
  lineId: string;
  rowId: string;
  shadeId: string;
  quantity: number;
};

export type MergedMaterialShade = {
  key: string;
  name: string;
  unit?: string;
  quantity: number;
  contributions: MergedShadeContribution[];
};

/** Näkymä. Ei tallenneta. */
export type MergedMaterialRow = {
  key: string;
  productId?: string;
  productName: string;
  unit?: string;
  quantity: number;
  shades: MergedMaterialShade[];
  contributions: MaterialContribution[];
};

export type MaterialLineEntry = {
  line: StructureLine;
  form?: FormDefinition;
};

function norm(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function rowMergeKey(source: MaterialRowSource): string {
  const unit = norm(source.row.unit);
  if (!source.row.productName.trim()) return `empty\u0000${source.lineId}\u0000${source.row.id}`;
  if (source.row.productId) return `id\u0000${source.row.productId}\u0000${unit}`;
  return `name\u0000${norm(source.row.productName)}\u0000${unit}`;
}

function shadeMergeKey(shade: MaterialShade): string {
  return `${norm(shade.name)}\u0000${norm(shade.unit)}`;
}

/**
 * Yksi yhdistäjä näytölle ja urakkakortin PDF:lle.
 * Avain: productId jos se on, muuten tuotenimi (trim, kirjainkoko). Lisäksi yksikkö samoin.
 * Tyhjä tuotenimi ei yhdisty. Eri yksikkö ei yhdisty. Sävyt yhdistyvät nimen ja yksikön mukaan.
 * Järjestys on ensimmäinen esiintyminen.
 * Rakenteen Määrä tasan 0 ei osallistu. Muu määrä kertoo litrat ja kappaleet.
 * Riviä ei poisteta tallennuksesta.
 */
export function mergeLineMaterials(sources: MaterialRowSource[]): MergedMaterialRow[] {
  const groups: MergedMaterialRow[] = [];
  const indexByKey = new Map<string, number>();

  for (const source of sources) {
    if (!source?.row || structureLineQuantityIsZero({ quantity: source.lineQuantity })) continue;
    const key = rowMergeKey(source);
    let group = indexByKey.has(key) ? groups[indexByKey.get(key)!] : undefined;
    if (!group) {
      group = {
        key,
        productName: source.row.productName,
        quantity: 0,
        shades: [],
        contributions: [],
      };
      if (source.row.productId && source.row.productName.trim()) group.productId = source.row.productId;
      if (source.row.unit !== undefined) group.unit = source.row.unit;
      indexByKey.set(key, groups.length);
      groups.push(group);
    }
    const quantity = source.lineQuantity === undefined ? 1 : source.lineQuantity;
    const rowQuantity = scaleByLineQuantity(source.row.quantity, quantity);
    group.quantity += rowQuantity;
    group.contributions.push({
      lineId: source.lineId,
      lineName: source.lineName,
      rowId: source.row.id,
      quantity: rowQuantity,
    });
    mergeShades(group, source, quantity);
  }
  return groups;
}

export const mergeMaterialRows = mergeLineMaterials;

function mergeShades(group: MergedMaterialRow, source: MaterialRowSource, quantity: number | null | undefined) {
  const shades = source.row.shades ?? [];
  for (const shade of shades) {
    const key = shadeMergeKey(shade);
    let merged = group.shades.find((item) => item.key === key);
    if (!merged) {
      merged = {
        key,
        name: shade.name,
        quantity: 0,
        contributions: [],
      };
      if (shade.unit !== undefined) merged.unit = shade.unit;
      group.shades.push(merged);
    }
    const shadeQuantity = scaleByLineQuantity(shade.quantity, quantity);
    merged.quantity += shadeQuantity;
    merged.contributions.push({
      lineId: source.lineId,
      rowId: source.row.id,
      shadeId: shade.id,
      quantity: shadeQuantity,
    });
  }
}

/** Jokaisen rivin effectiveMaterialQuantities, lomakejärjestyksessä. Ei muuta rivejä. */
export type MergedMaterialDetailRow = {
  productName: string;
  value: string;
  shades: { name: string; value: string }[];
};

function materialAmountLabel(quantity: number, unit: string | undefined): string {
  const trimmed = unit?.trim() ?? '';
  const safeUnit = trimmed.includes('€') ? '' : trimmed;
  return [formatQuantity(quantity), safeUnit].filter((part) => part.length > 0).join(' ');
}

/** Laskelmanäkymän rivit samasta yhdistelmästä kuin editori ja PDF. */
export function mergedMaterialDetailRows(
  entries: MaterialLineEntry[],
  products: Product[],
): MergedMaterialDetailRow[] {
  return mergedMaterialsForLines(entries, products)
    .filter((group) => {
      if (!group.productName.trim() || group.productName.includes('€') || group.unit?.includes('€')) return false;
      const shades = group.shades.filter(
        (shade) => shade.name.trim() && shade.quantity > 0 && !shade.name.includes('€') && !shade.unit?.includes('€'),
      );
      return shades.length > 0 || group.quantity > 0;
    })
    .map((group) => {
      const productName = group.productName.replaceAll('€', '').trim() || 'Materiaali';
      const shades = group.shades.filter(
        (shade) => shade.name.trim() && shade.quantity > 0 && !shade.name.includes('€') && !shade.unit?.includes('€'),
      );
      if (shades.length > 0) {
        return {
          productName,
          value: '',
          shades: shades.map((shade) => ({
            name: shade.name.trim(),
            value: materialAmountLabel(shade.quantity, shade.unit),
          })),
        };
      }
      return {
        productName,
        value: materialAmountLabel(group.quantity, group.unit),
        shades: [],
      };
    });
}

export function mergedMaterialsForLines(
  entries: MaterialLineEntry[],
  products: Product[],
): MergedMaterialRow[] {
  const sources: MaterialRowSource[] = [];
  for (const entry of entries) {
    const rows = effectiveMaterialQuantities(entry.line, entry.form, products);
    for (const row of rows) {
      sources.push({
        lineId: entry.line.id,
        lineName: entry.line.name,
        lineQuantity: entry.line.quantity,
        row,
      });
    }
  }
  return mergeLineMaterials(sources);
}

export function baseMaterialRows(
  line: StructureLine,
  form: FormDefinition | undefined,
  products: Product[],
): MaterialQuantityRow[] {
  if (line.materialQuantities !== undefined) return line.materialQuantities;
  return prefillMaterialQuantities(line, form, products);
}

/** Sama muokkaus jokaiselle kohderiville. Yksi rivi päivittyy kerran. */
export function mapMaterialEdit(
  lines: StructureLine[],
  targets: { lineId: string; rowId: string }[],
  edit: (rows: MaterialQuantityRow[], rowId: string) => MaterialQuantityRow[],
  baseRows: (line: StructureLine) => MaterialQuantityRow[],
): StructureLine[] {
  const idsByLine = new Map<string, string[]>();
  for (const target of targets) {
    const list = idsByLine.get(target.lineId) ?? [];
    list.push(target.rowId);
    idsByLine.set(target.lineId, list);
  }
  if (idsByLine.size === 0) return lines;
  return lines.map((line) => {
    const rowIds = idsByLine.get(line.id);
    if (!rowIds || rowIds.length === 0) return line;
    let rows = baseRows(line);
    for (const rowId of rowIds) rows = edit(rows, rowId);
    return { ...line, materialQuantities: rows };
  });
}

/** Siirtää yhden manuaalirivin toiselle rakenteelle. Sama tunnus säilyy. */
export function moveMaterialRow(
  lines: StructureLine[],
  fromLineId: string,
  rowId: string,
  toLineId: string,
  baseRows: (line: StructureLine) => MaterialQuantityRow[],
): StructureLine[] {
  if (fromLineId === toLineId) return lines;
  const from = lines.find((line) => line.id === fromLineId);
  const to = lines.find((line) => line.id === toLineId);
  if (!from || !to) return lines;
  const sourceRows = baseRows(from);
  const row = sourceRows.find((item) => item.id === rowId);
  if (!row) return lines;
  const sourceNext = removeMaterialRow(sourceRows, rowId);
  const moved: MaterialQuantityRow = {
    ...row,
    shades: row.shades?.map((shade) => ({ ...shade })),
  };
  const targetNext = [
    ...baseRows(to).map((item) => ({ ...item, shades: item.shades?.map((shade) => ({ ...shade })) })),
    moved,
  ];
  return lines.map((line) => {
    if (line.id === fromLineId) return { ...line, materialQuantities: sourceNext };
    if (line.id === toLineId) return { ...line, materialQuantities: targetNext };
    return line;
  });
}
