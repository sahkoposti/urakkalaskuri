import { fieldsForPage } from '@/src/core/form/formDefinitionHelpers';
import { resolveFieldRawValue } from '@/src/core/form/fieldDefaultValue';
import { isFieldVisible } from '@/src/core/form/fieldVisibility';
import {
  findProductById,
  getSelectedProductId,
  isProductField,
} from '@/src/core/form/productFieldUtils';
import { isSystemField } from '@/src/core/form/systemFields';
import type { FormDefinition, FormPage } from '@/src/core/form/types';
import type { Product, WizardLineDraft } from '@/src/core/models/types';
import { structureFormPages } from '@/src/core/structure/formPages';
import { parseNumber } from '@/src/core/utils/formatters';
import { isDiscountPercentKey } from '@/src/core/calculation/discount';

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
  materialLines: WizardLineDraft[] = [],
  options?: { requireCustomerName?: boolean },
): string | null {
  const requireCustomerName = options?.requireCustomerName ?? true;
  if (page.system === 'customer' && requireCustomerName && !customerName.trim()) {
    return 'Anna asiakkaan nimi.';
  }

  if (page.system === 'materials') {
    for (const [index, line] of materialLines.entries()) {
      if (!(line.quantity > 0)) {
        return `Materiaalirivi ${index + 1}: määrän on oltava suurempi kuin 0.`;
      }
      if (!products.some((product) => product.id === line.product.id)) {
        return `Materiaalirivi ${index + 1}: valittu tuote ei ole enää saatavilla.`;
      }
    }
  }
  for (const field of fieldsForPage(form, page.id)) {
    if (field.type === 'section') {
      continue;
    }

    if (isDiscountPercentKey(field.key) || field.systemKey === 'alennus_prosentti') {
      const raw = resolveFieldRawValue(field, fieldValues).trim();
      if (raw) {
        const parsed = parseNumber(raw);
        if (parsed === null) {
          return `${field.label}: anna kelvollinen numero.`;
        }
        if (parsed < 0 || parsed > 100) {
          return `${field.label}: anna 0–100 %.`;
        }
      }
    }

    if (field.type === 'computed' || isSystemField(field)) {
      continue;
    }
    if (!isFieldVisible(field, fieldValues, form, new Set(), numericContext)) {
      continue;
    }

    const raw = resolveFieldRawValue(field, fieldValues).trim();
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
      const productId = getSelectedProductId(fieldValues, field.key, field);
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

export function validateAllFormPages(
  form: FormDefinition,
  fieldValues: Record<string, string>,
  products: Product[] = [],
  numericContext?: Record<string, number>,
): string | null {
  for (const page of structureFormPages(form)) {
    const error = validateFormPageWithValues(
      form,
      page,
      fieldValues,
      '',
      products,
      numericContext,
      [],
      { requireCustomerName: false },
    );
    if (error) return error;
  }
  return null;
}

export function isStructureFormFullyFilled(
  form: FormDefinition,
  fieldValues: Record<string, string>,
  products: Product[] = [],
  numericContext?: Record<string, number>,
): boolean {
  return validateAllFormPages(form, fieldValues, products, numericContext) === null;
}

export function hasFieldValueContent(fieldValues: Record<string, string>): boolean {
  return Object.values(fieldValues).some((value) => value.trim().length > 0);
}
