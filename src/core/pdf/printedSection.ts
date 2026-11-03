import type { PrintEsitys, PrintGroup } from '@/src/core/form/types';
import { defaultEsitys } from '@/src/core/form/printSettings';
import { stripTrailingZeroDecimals } from '@/src/core/utils/formatters';

import type { PrintRow } from './printableFields';

export const PRINT_GROUP_ORDER: readonly PrintGroup[] = ['osa_alueet', 'tyovaiheet', 'muuta', 'tieto', 'maali'];

export const PRINT_GROUP_TITLES: Record<PrintGroup, string> = {
  osa_alueet: 'Osa-alueet',
  tyovaiheet: 'Työvaiheet',
  muuta: 'Muuta',
  tieto: '',
  maali: 'Maali',
};

export type PrintedTextGroup = {
  group: PrintGroup;
  title: string;
  items: string[];
};

export type PrintedTableRow = {
  label: string;
  value: string;
};

export type PrintedBody = {
  textGroups: PrintedTextGroup[];
  tableRows: PrintedTableRow[];
};

function displayQuantity(value: string, unit: string | undefined, numeric: boolean | undefined): string {
  const trimmed = value.trim();
  if (!numeric) return trimmed;
  return stripTrailingZeroDecimals(trimmed, unit);
}

function phrase(row: PrintRow): string {
  const label = row.label.trim();
  const value = displayQuantity(row.value, row.unit, row.numeric);
  if (!label) return value;
  if (!value || value === 'Kyllä' || value === label) return label;
  return `${label} ${value}`;
}

function valueHasUnit(value: string, unit: string): boolean {
  return value === unit || value.endsWith(` ${unit}`);
}

function withUnit(value: string, unit: string | undefined): string {
  const trimmed = value.trim();
  const normalized = unit?.trim();
  if (normalized && trimmed && !valueHasUnit(trimmed, normalized)) return `${trimmed} ${normalized}`;
  return trimmed;
}

function tietoLine(row: PrintRow): string {
  const label = row.label.trim();
  const value = displayQuantity(withUnit(row.value, row.unit), row.unit, row.numeric);
  if (!label) return value;
  return `${label} ${value}`.trim();
}

function quantityText(quantity: NonNullable<PrintRow['quantity']>): string {
  const unit = quantity.unit?.trim() ?? '';
  const amount = stripTrailingZeroDecimals(quantity.value.trim(), unit);
  if (!unit || amount.endsWith(` ${unit}`)) return amount;
  return `${amount} ${unit}`.trim();
}

function maaliLine(row: PrintRow, includeQuantity: boolean): string {
  const name = row.value.trim();
  if (!includeQuantity) return name;
  const quantity = row.quantity;
  if (!quantity) return name;
  const amount = quantityText(quantity);
  if (!amount) return name;
  return name ? `${name} ${amount}` : amount;
}

function rowEsitys(row: PrintRow): PrintEsitys {
  return row.esitys === 'teksti' || row.esitys === 'taulukko' ? row.esitys : defaultEsitys(row.group);
}

function textItem(row: PrintRow, includePaintQuantity: boolean): string {
  if (row.group === 'maali') return maaliLine(row, includePaintQuantity);
  if (row.group === 'tieto') return tietoLine(row);
  return phrase(row);
}

function tableValue(row: PrintRow): string {
  if (row.group === 'maali') return row.value.trim();
  return displayQuantity(withUnit(row.value, row.unit), row.unit, row.numeric);
}

/** Tekstiryhmät ja kaksipalstainen taulukko. Tyhjät osat jäävät pois. */
export function buildPrintedBody(rows: PrintRow[], options?: { includePaintQuantity?: boolean }): PrintedBody {
  const includePaintQuantity = options?.includePaintQuantity !== false;
  const buckets = new Map<PrintGroup, string[]>();
  const tableRows: PrintedTableRow[] = [];
  for (const row of rows) {
    if (!row) continue;
    if (rowEsitys(row) === 'taulukko') {
      tableRows.push({ label: row.label.trim(), value: tableValue(row) });
      continue;
    }
    const item = textItem(row, includePaintQuantity);
    if (!item) continue;
    const list = buckets.get(row.group) ?? [];
    list.push(item);
    buckets.set(row.group, list);
  }
  const textGroups = PRINT_GROUP_ORDER.filter((group) => (buckets.get(group)?.length ?? 0) > 0).map((group) => ({
    group,
    title: PRINT_GROUP_TITLES[group],
    items: buckets.get(group) ?? [],
  }));
  return { textGroups, tableRows };
}

export function appendPrintedText(body: PrintedBody, group: PrintGroup, item: string): void {
  const trimmed = item.trim();
  if (!trimmed) return;
  const existing = body.textGroups.find((entry) => entry.group === group);
  if (existing) {
    existing.items.push(trimmed);
    return;
  }
  body.textGroups.push({ group, title: PRINT_GROUP_TITLES[group], items: [trimmed] });
  body.textGroups.sort(
    (a, b) => PRINT_GROUP_ORDER.indexOf(a.group) - PRINT_GROUP_ORDER.indexOf(b.group),
  );
}
