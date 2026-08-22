import type { FormDefinition } from '@/src/core/form/types';
import { isProductField } from '@/src/core/form/productFieldUtils';
import type { Product } from '@/src/core/models/types';

/** Kaavoissa käytettävät tuoteattribuutit. Nimi on näyttöarvo, ei kaavamuuttuja. */
export const PRODUCT_FORMULA_ATTRIBUTES = [
  { key: 'yksikkohinta', aliases: ['unit_price', 'hinta'], label: 'Yksikköhinta (alv0)' },
  { key: 'menekki', aliases: ['consumption'], label: 'Menekki' },
  { key: 'tyokerroin', aliases: ['work_factor'], label: 'Työkerroin' },
  { key: 'materiaalikerroin', aliases: ['material_factor'], label: 'Materiaalikerroin' },
] as const;

const ATTRIBUTE_FORMULA_KEYS: Record<string, string[]> = {
  consumption: ['menekki', 'consumption'],
  work_factor: ['tyokerroin', 'work_factor'],
  material_factor: ['materiaalikerroin', 'material_factor'],
  purchase_price: ['ostohinta', 'purchase_price'],
  sale_price: ['myyntihinta', 'sale_price'],
};

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
  options?: { quantity?: number },
): void {
  writeContextKeys(context, fieldKey, ['yksikkohinta', 'unit_price', 'hinta'], product.unitPriceVat0);

  for (const [attribute, value] of Object.entries(product.attributes ?? {})) {
    if (!Number.isFinite(value)) continue;
    const keys = ATTRIBUTE_FORMULA_KEYS[attribute] ?? [attribute];
    writeContextKeys(context, fieldKey, keys, value);
  }

  if (options?.quantity !== undefined && Number.isFinite(options.quantity)) {
    writeContextKeys(context, fieldKey, ['maara', 'quantity'], options.quantity);
  }
}
