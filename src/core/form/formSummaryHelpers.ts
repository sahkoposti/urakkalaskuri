import { fieldsForPage, sortedPages } from '@/src/core/form/formDefinitionHelpers';
import {
  findProductById,
  getFieldProductQuantity,
  getSelectedProductId,
} from '@/src/core/form/productFieldUtils';
import { isSystemField } from '@/src/core/form/systemFields';
import type { FormDefinition, FormField } from '@/src/core/form/types';
import type { FormSnapshot, FormSnapshotField, Product } from '@/src/core/models/types';
import { formatDecimal } from '@/src/core/utils/formatters';

export function formatFieldSummaryValue(
  field: FormField,
  fieldValues: Record<string, string>,
  context: Record<string, number>,
  products: Product[] = [],
): string {
  if (field.type === 'product_select') {
    const product = findProductById(products, getSelectedProductId(fieldValues, field.key));
    return product?.name ?? '–';
  }

  if (field.type === 'product_quantity') {
    const product = findProductById(products, getSelectedProductId(fieldValues, field.key));
    const quantity = getFieldProductQuantity(fieldValues, field.key);
    if (!product || quantity === null) return '–';
    return `${product.name} × ${formatDecimal(quantity)} ${product.unit}`;
  }

  if (field.type === 'computed' || field.type === 'number' || field.type === 'select') {
    const num = context[field.key];
    if (num !== undefined && Number.isFinite(num)) {
      return `${formatDecimal(num)}${field.unit ? ` ${field.unit}` : ''}`;
    }
  }

  if (field.type === 'boolean') {
    return fieldValues[field.key] === 'true' ? 'Kyllä' : 'Ei';
  }

  if (field.type === 'text') {
    const text = fieldValues[field.key]?.trim();
    return text || '–';
  }

  return '–';
}

export function summaryDisplayFields(form: FormDefinition): FormField[] {
  const seen = new Set<string>();
  const fields: FormField[] = [];

  for (const page of sortedPages(form)) {
    for (const field of fieldsForPage(form, page.id)) {
      if (field.type === 'section' || isSystemField(field) || !field.showOnSummary) continue;
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
      fields.push({
        key: field.key,
        label: field.label,
        unit: field.unit,
        value: formatFieldSummaryValue(field, fieldValues, context, products),
        pageTitle: page.title,
      });
    }
  }

  return {
    formId: form.id,
    formVersion: form.version,
    fields,
  };
}
