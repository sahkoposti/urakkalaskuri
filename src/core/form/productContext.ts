import type { FormDefinition } from '@/src/core/form/types';
import { isProductField } from '@/src/core/form/productFieldUtils';
import type { Product } from '@/src/core/models/types';
import {
  productConsumption,
  productWorkFactor,
} from '@/src/core/product/productAttributes';

/** Kaavoissa käytettävät tuoteattribuutit. Nimi on näyttöarvo, ei kaavamuuttuja. */
export const PRODUCT_FORMULA_ATTRIBUTES = [
  { key: 'yksikkohinta', aliases: ['unit_price', 'hinta'], label: 'Yksikköhinta (alv0)' },
  { key: 'menekki', aliases: ['consumption'], label: 'Menekki' },
  { key: 'tyokerroin', aliases: ['work_factor'], label: 'Työkerroin' },
] as const;

export function productFormulaIdentifiers(fieldKey: string): string[] {
  return PRODUCT_FORMULA_ATTRIBUTES.flatMap((item) => [
    `${fieldKey}.${item.key}`,
    ...item.aliases.map((alias) => `${fieldKey}.${alias}`),
  ]);
}

export function productFieldsInForm(form: FormDefinition) {
  return form.fields.filter(isProductField);
}

function writeContextKeys(
  context: Record<string, number>,
  fieldKey: string,
  keys: readonly string[],
  value: number,
): void {
  for (const key of keys) {
    context[`${fieldKey}.${key}`] = value;
  }
}

/** Täyttää kaavakontekstiin `{key}.yksikkohinta`, `{key}.menekki` jne. */
export function exportProductToContext(
  fieldKey: string,
  product: Product,
  context: Record<string, number>,
): void {
  writeContextKeys(context, fieldKey, ['yksikkohinta', 'unit_price', 'hinta'], product.unitPriceVat0);

  const consumption = productConsumption(product.attributes);
  if (consumption !== undefined) {
    writeContextKeys(context, fieldKey, ['menekki', 'consumption'], consumption);
  }

  writeContextKeys(context, fieldKey, ['tyokerroin', 'work_factor'], productWorkFactor(product.attributes));
}
