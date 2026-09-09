import { fieldsForPage, sortedPages } from '@/src/core/form/formDefinitionHelpers';
import { resolveFieldRawValue } from '@/src/core/form/fieldDefaultValue';
import { isFieldVisibleOnSummary } from '@/src/core/form/fieldVisibility';
import {
  findProductById,
  getSelectedProductId,
} from '@/src/core/form/productFieldUtils';
import { isSystemField } from '@/src/core/form/systemFields';
import type { FormDefinition, FormField } from '@/src/core/form/types';
import type { FormSnapshot, FormSnapshotField, Product } from '@/src/core/models/types';
import {
  displayWorkDurationText,
  formatCurrency,
  formatDecimal,
  formatWorkDurationDays,
  isWorkDurationDaysKey,
} from '@/src/core/utils/formatters';

export function formatFieldSummaryValue(
  field: FormField,
  fieldValues: Record<string, string>,
  context: Record<string, number>,
  products: Product[] = [],
): string {
  if (field.type === 'product_select') {
    const product = findProductById(products, getSelectedProductId(fieldValues, field.key, field));
    return product?.name ?? '–';
  }

  if (field.type === 'select') {
    const raw = resolveFieldRawValue(field, fieldValues);
    if (!raw) return '–';
    return field.options?.find((option) => option.value === raw)?.label ?? raw;
  }

  if (field.type === 'computed' || field.type === 'number') {
    const num = context[field.key];
    if (num !== undefined && Number.isFinite(num)) {
      if (field.unit === '€') {
        return formatCurrency(num);
      }
      if (isWorkDurationDaysKey(field.key) || field.systemKey === 'tyoryhma_kesto_pv') {
        return `${formatWorkDurationDays(num)}${field.unit ? ` ${field.unit}` : ''}`;
      }
      return `${formatDecimal(num)}${field.unit ? ` ${field.unit}` : ''}`;
    }
  }

  if (field.type === 'boolean') {
    const raw = resolveFieldRawValue(field, fieldValues);
    return raw === 'true' ? 'Kyllä' : 'Ei';
  }

  if (field.type === 'text') {
    const text = resolveFieldRawValue(field, fieldValues);
    return text || '–';
  }

  return '–';
}

export function summaryDisplayFields(
  form: FormDefinition,
  fieldValues: Record<string, string> = {},
  numericContext?: Record<string, number>,
): FormField[] {
  const seen = new Set<string>();
  const fields: FormField[] = [];

  for (const page of sortedPages(form)) {
    for (const field of fieldsForPage(form, page.id)) {
      if (field.type === 'section' || isSystemField(field) || !field.showOnSummary) continue;
      if (!isFieldVisibleOnSummary(field, fieldValues, form, numericContext)) continue;
      if (seen.has(field.id)) continue;
      seen.add(field.id);
      fields.push(field);
    }
  }

  return fields;
}

export function buildFormSnapshot(
  form: FormDefinition,
  fieldValues: Record<string, string>,
  context: Record<string, number>,
  products: Product[] = [],
): FormSnapshot {
  const fields: FormSnapshotField[] = [];

  for (const page of sortedPages(form)) {
    for (const field of fieldsForPage(form, page.id)) {
      if (field.type === 'section' || isSystemField(field) || !field.showOnSummary) continue;
      if (!isFieldVisibleOnSummary(field, fieldValues, form, context)) continue;
      fields.push({
        key: field.key,
        label: displayWorkDurationText(field.label),
        unit: field.unit,
        value: formatFieldSummaryValue(field, fieldValues, context, products),
        pageTitle: displayWorkDurationText(page.title),
      });
    }
  }

  return {
    formId: form.id,
    formVersion: form.version,
    fields,
    /** Kaikki syötetyt arvot (myös piilotetut) – muokkauksen palautukseen */
    fieldValues: { ...fieldValues },
  };
}

export function hasSummarySnapshotFields(snapshot?: FormSnapshot | null): boolean {
  return Boolean(snapshot?.fields && snapshot.fields.length > 0);
}

/** Rivin yhteenvedon lomaketiedot: valmis snapshot tai live-kentät. */
export function lineFormSnapshot(
  line: { snapshot?: FormSnapshot; fieldValues?: Record<string, string> },
  form: FormDefinition | undefined,
  products: Product[] = [],
  context: Record<string, number> = {},
): FormSnapshot | undefined {
  if (hasSummarySnapshotFields(line.snapshot)) return line.snapshot;
  if (!form) return undefined;
  const built = buildFormSnapshot(form, line.fieldValues ?? {}, context, products);
  return built.fields.length > 0 ? built : undefined;
}
