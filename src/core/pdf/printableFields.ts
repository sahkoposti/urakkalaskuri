import { resolveFieldRawValue } from '@/src/core/form/fieldDefaultValue';
import { isFieldVisible, isFieldVisibleOnSummary } from '@/src/core/form/fieldVisibility';
import { fieldsForPage, sortedPages } from '@/src/core/form/formDefinitionHelpers';
import { formatFieldSummaryValue } from '@/src/core/form/formSummaryHelpers';
import { passesPrintWhen, resolveTargetPrint } from '@/src/core/form/printSettings';
import { isSystemField } from '@/src/core/form/systemFields';
import type { FormDefinition, FormField, PrintGroup, PrintWhen } from '@/src/core/form/types';
import type { FormSnapshot, Product } from '@/src/core/models/types';
import { displayWorkDurationText } from '@/src/core/utils/formatters';

/** Yksi tulostettava rivi. Ei kytketty PDF-koostajiin (P3/P4). */
export type PrintRow = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  group: PrintGroup;
  order: number;
  quantity?: { value: string; unit?: string };
};

export type PrintableFieldsInput = {
  form: FormDefinition;
  fieldValues: Record<string, string>;
  context: Record<string, number>;
  products: Product[];
  snapshot?: FormSnapshot;
  target: 'offer' | 'urakkakortti';
};

const PRINT_GROUPS: readonly PrintGroup[] = ['osa_alueet', 'tyovaiheet', 'muuta', 'tieto', 'maali'];
const EMPTY_DISPLAY = '–';

function isEmptyDisplay(value: string | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  return trimmed === '' || trimmed === EMPTY_DISPLAY;
}

function parseLeadingFiNumber(value: string): number | undefined {
  const compact = value.trim().replace(/[\s\u00a0\u202f]/g, '');
  const match = compact.match(/^-?\d+(?:[.,]\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0].replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Snapshotin arvo muunnetaan samaksi when-syötteeksi kuin elävä arvo. */
function rawAndNum(
  field: FormField,
  fieldValues: Record<string, string>,
  context: Record<string, number>,
  saved: string | undefined,
): { raw: string | undefined; num: number | undefined } {
  if (saved === undefined) {
    return {
      raw: resolveFieldRawValue(field, fieldValues),
      num: context[field.key],
    };
  }
  if (isEmptyDisplay(saved)) return { raw: '', num: undefined };
  if (field.type === 'boolean') {
    const trimmed = saved.trim();
    if (trimmed === 'Kyllä') return { raw: 'true', num: undefined };
    if (trimmed === 'Ei') return { raw: 'false', num: undefined };
    return { raw: '', num: undefined };
  }
  if (field.type === 'number' || field.type === 'computed') {
    return { raw: undefined, num: parseLeadingFiNumber(saved) };
  }
  return { raw: saved.trim(), num: undefined };
}

function formPosition(form: FormDefinition): Map<string, number> {
  const positions = new Map<string, number>();
  let index = 0;
  for (const page of sortedPages(form)) {
    for (const fieldId of page.fieldIds ?? []) {
      if (!positions.has(fieldId)) {
        positions.set(fieldId, index);
        index += 1;
      }
    }
  }
  return positions;
}

function quantityFromField(
  quantityKey: string | undefined,
  form: FormDefinition,
  fieldValues: Record<string, string>,
  context: Record<string, number>,
  products: Product[],
  snapshotFields: FormSnapshot['fields'],
): PrintRow['quantity'] | undefined {
  if (!quantityKey) return undefined;
  const source = form.fields.find((item) => item.key === quantityKey);
  if (!source) return undefined;
  const saved = snapshotFields.find((item) => item?.key === quantityKey);
  const formatted =
    saved && typeof saved.value === 'string'
      ? saved.value
      : formatFieldSummaryValue(source, fieldValues, context, products);
  if (isEmptyDisplay(formatted)) return undefined;
  const unit = source.unit;
  const suffix = unit ? ` ${unit}` : '';
  const value = unit && formatted.endsWith(suffix) ? formatted.slice(0, -suffix.length) : formatted;
  if (!value.trim()) return undefined;
  return unit ? { value, unit } : { value };
}

function collectPrintableFields(input: PrintableFieldsInput): PrintRow[] {
  const { form, target } = input;
  if (!form || !Array.isArray(form.fields) || !Array.isArray(form.pages)) return [];
  if (target !== 'offer' && target !== 'urakkakortti') return [];

  const fieldValues = input.fieldValues ?? {};
  const context = input.context ?? {};
  const products = input.products ?? [];
  const snapshotFields = Array.isArray(input.snapshot?.fields) ? input.snapshot.fields : [];
  const positions = formPosition(form);
  const seen = new Set<string>();
  const rows: Array<PrintRow & { position: number }> = [];

  for (const page of sortedPages(form)) {
    for (const field of fieldsForPage(form, page.id)) {
      if (seen.has(field.id)) continue;
      seen.add(field.id);
      if (field.type === 'section' || isSystemField(field)) continue;

      const resolved = resolveTargetPrint(field, target, form);
      if (!resolved) continue;
      if (!isFieldVisible(field, fieldValues, form, new Set(), context)) continue;
      if (resolved.legacy && !isFieldVisibleOnSummary(field, fieldValues, form, context)) continue;

      const savedEntry = snapshotFields.find((item) => item?.key === field.key);
      const saved = typeof savedEntry?.value === 'string' ? savedEntry.value : undefined;
      const value =
        saved !== undefined ? saved : formatFieldSummaryValue(field, fieldValues, context, products);
      const { raw, num } = rawAndNum(field, fieldValues, context, saved);
      const when: PrintWhen = resolved.when;
      if (!passesPrintWhen(when, field, raw, num)) continue;
      if (isEmptyDisplay(value)) continue;
      if (target === 'urakkakortti' && (field.unit === '€' || value.includes('€'))) continue;

      const position = positions.get(field.id) ?? rows.length;
      const row: PrintRow & { position: number } = {
        key: field.key,
        label: resolved.label !== undefined ? resolved.label : displayWorkDurationText(field.label),
        value,
        group: resolved.group,
        order: resolved.order ?? position,
        position,
      };
      if (field.unit) row.unit = field.unit;
      const quantity = quantityFromField(resolved.quantityKey, form, fieldValues, context, products, snapshotFields);
      if (quantity) row.quantity = quantity;
      rows.push(row);
    }
  }

  rows.sort((a, b) => a.order - b.order || a.position - b.position);
  return rows.map(({ position: _position, ...row }) => row);
}

/** Kentät tulostusjärjestyksessä. Tyhjä lista, jos syöte on kelvoton. Ei heitä. */
export function printableFields(input: PrintableFieldsInput): PrintRow[] {
  try {
    return collectPrintableFields(input);
  } catch {
    return [];
  }
}

/** Ryhmät aina mukana, myös tyhjinä. Rivien järjestys säilyy. */
export function groupPrintRows(rows: PrintRow[]): Record<PrintGroup, PrintRow[]> {
  const grouped: Record<PrintGroup, PrintRow[]> = {
    osa_alueet: [],
    tyovaiheet: [],
    muuta: [],
    tieto: [],
    maali: [],
  };
  if (!Array.isArray(rows)) return grouped;
  for (const row of rows) {
    if (!row) continue;
    const group = (PRINT_GROUPS as readonly string[]).includes(row.group) ? row.group : 'tieto';
    grouped[group].push(row);
  }
  return grouped;
}
