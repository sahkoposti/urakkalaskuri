import type { FormDefinition } from '@/src/core/form/types';
import { isProductField } from '@/src/core/form/productFieldUtils';
import type { Product } from '@/src/core/models/types';

/** Kaavoissa käytettävät tuoteattribuutit. Nimi on näyttöarvo, ei kaavamuuttuja. */
export const PRODUCT_FORMULA_ATTRIBUTES = [
  { key: 'unit_price', label: 'Yksikköhinta (alv0)' },
  { key: 'consumption', label: 'Menekki' },
  { key: 'work_factor', label: 'Työkerroin' },
  { key: 'material_factor', label: 'Materiaalikerroin' },
] as const;

export function productFormulaIdentifiers(fieldKey: string): string[] {
  return PRODUCT_FORMULA_ATTRIBUTES.map((item) => `${fieldKey}.${item.key}`);
}

export function productFieldsInForm(form: FormDefinition) {
  return form.fields.filter(isProductField);
}

/** Täyttää kaavakontekstiin `{key}.unit_price`, `{key}.consumption` jne. */
export function exportProductToContext(
  fieldKey: string,
  product: Product,
  context: Record<string, number>,
  options?: { quantity?: number },
): void {
  context[`${fieldKey}.unit_price`] = product.unitPriceVat0;

  for (const [attribute, value] of Object.entries(product.attributes ?? {})) {
    if (Number.isFinite(value)) {
      context[`${fieldKey}.${attribute}`] = value;
    }
  }

  if (options?.quantity !== undefined && Number.isFinite(options.quantity)) {
    context[`${fieldKey}.quantity`] = options.quantity;
  }
}
