import { fieldsForPage } from '@/src/core/form/formDefinitionHelpers';
import { isFieldVisible } from '@/src/core/form/fieldVisibility';
import {
  findProductById,
  getSelectedProductId,
  isProductField,
} from '@/src/core/form/productFieldUtils';
import { isSystemField } from '@/src/core/form/systemFields';
import type { FormDefinition, FormPage } from '@/src/core/form/types';
import type { Product } from '@/src/core/models/types';
import { parseNumber } from '@/src/core/utils/formatters';

export function getDurationDaysFromValues(
  fieldValues: Record<string, string>,
  legacyDuration = '',
): number | null {
  const raw = fieldValues.tyoryhma_kesto_pv?.trim() || legacyDuration.trim();
  if (!raw) return null;
  const parsed = parseNumber(raw);
  if (parsed === null || parsed <= 0) return null;
  return parsed;
}

export function validateFormPageWithValues(
  form: FormDefinition,
  page: FormPage,
  fieldValues: Record<string, string>,
  customerName = '',
  products: Product[] = [],
  numericContext?: Record<string, number>,
): string | null {
  if (page.system === 'customer' && !customerName.trim()) {
    return 'Anna asiakkaan nimi.';
  }
  for (const field of fieldsForPage(form, page.id)) {
    if (field.type === 'section' || field.type === 'computed' || isSystemField(field)) {
      continue;
    }
    if (!isFieldVisible(field, fieldValues, form, new Set(), numericContext)) {
      continue;
    }

    const raw =
      fieldValues[field.key]?.trim() ||
      (field.type === 'select' ? field.defaultValue?.trim() : undefined) ||
      '';
    if (field.required && !raw) {
      return `${field.label}: kenttä on pakollinen.`;
    }

    if (field.type === 'number' && raw) {
      const parsed = parseNumber(raw);
      if (parsed === null) {
        return `${field.label}: anna kelvollinen numero.`;
      }
      if (field.key === 'tyoryhma_kesto_pv' && parsed <= 0) {
        return `${field.label}: keston on oltava suurempi kuin 0.`;
      }
    }

    if (isProductField(field)) {
      const productId = getSelectedProductId(fieldValues, field.key);
      if (field.required && !productId) {
        return `${field.label}: valitse tuote.`;
      }
      if (productId && !findProductById(products, productId)) {
        return `${field.label}: valittu tuote ei ole enää saatavilla.`;
      }
    }
  }

  return null;
}

export function hasFieldValueContent(fieldValues: Record<string, string>): boolean {
  return Object.values(fieldValues).some((value) => value.trim().length > 0);
}
