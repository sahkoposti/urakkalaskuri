import type { FieldValue, FormDefinition, FormField, ProductQuantityValue } from '@/src/core/form/types';
import { parseNumber } from '@/src/core/utils/formatters';
import { formatDecimal } from '@/src/core/utils/formatters';

function isProductQuantityValue(value: unknown): value is ProductQuantityValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'productId' in value &&
    'quantity' in value
  );
}

export function sortedFormPages(form: FormDefinition) {
  return [...form.pages].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function pageFields(form: FormDefinition, pageId: string): FormField[] {
  return form.fields
    .filter((field) => field.pageId === pageId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function fieldValueToInput(value: FieldValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value).replace('.', ',');
  if (typeof value === 'string') return value;
  if (isProductQuantityValue(value)) return value.productId;
  return '';
}

export function quantityToInput(value: FieldValue): string {
  if (isProductQuantityValue(value)) return String(value.quantity).replace('.', ',');
  if (typeof value === 'number') return String(value).replace('.', ',');
  return '';
}

export function parseInputValue(field: FormField, raw: string, quantityRaw?: string): FieldValue {
  const trimmed = raw.trim();
  switch (field.type) {
    case 'number':
      return parseNumber(trimmed);
    case 'boolean':
      if (!trimmed) return null;
      return trimmed === 'true' || trimmed === 'kyllä' || trimmed === '1';
    case 'product_select':
      return trimmed || null;
    case 'product_quantity': {
      const quantity = parseNumber(quantityRaw ?? '');
      if (!trimmed || quantity === null) return null;
      return { productId: trimmed, quantity };
    }
    case 'select':
    case 'text':
      return trimmed || null;
    default:
      return trimmed || null;
  }
}

export function formatSummaryDisplay(value: string | number | boolean, unit?: string): string {
  if (typeof value === 'boolean') return value ? 'Kyllä' : 'Ei';
  if (typeof value === 'number') {
    return unit ? `${formatDecimal(value)} ${unit}` : formatDecimal(value);
  }
  if (value === '–' || value === '') return '–';
  return unit ? `${value} ${unit}` : String(value);
}

export function isFieldEmpty(field: FormField, value: FieldValue): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value === 'number') return !Number.isFinite(value);
  if (isProductQuantityValue(value)) return !value.productId || value.quantity <= 0;
  return false;
}

export function validatePageValues(
  form: FormDefinition,
  pageId: string,
  values: Record<string, FieldValue>,
): string | null {
  for (const field of pageFields(form, pageId)) {
    if (field.type === 'section' || field.type === 'computed') continue;
    const value = values[field.key];
    if (field.required && isFieldEmpty(field, value)) {
      return `Anna ${field.label.toLowerCase()}.`;
    }
    if (field.type === 'number' && value !== null && value !== undefined && value !== '') {
      if (typeof value !== 'number') {
        return `${field.label}: virheellinen luku.`;
      }
    }
  }
  return null;
}

export function groupSummaryFields(
  fields: { key: string; label: string; value: string | number | boolean; unit?: string; pageTitle: string }[],
): { title: string; fields: typeof fields }[] {
  const groups: { title: string; fields: typeof fields }[] = [];
  for (const field of fields) {
    const last = groups[groups.length - 1];
    if (!last || last.title !== field.pageTitle) {
      groups.push({ title: field.pageTitle, fields: [field] });
    } else {
      last.fields.push(field);
    }
  }
  return groups;
}

export function hasFieldContent(values: Record<string, FieldValue>): boolean {
  return Object.values(values).some((value) => {
    if (value === null || value === undefined || value === '') return false;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'boolean') return true;
    if (typeof value === 'object' && 'productId' in value) {
      return Boolean(value.productId) && value.quantity > 0;
    }
    return String(value).trim().length > 0;
  });
}
