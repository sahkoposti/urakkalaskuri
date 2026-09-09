import type { FormDefinition } from '@/src/core/form/types';
import { isProductField } from '@/src/core/form/productFieldUtils';
import type { Product } from '@/src/core/models/types';
import {
  productConsumption,
  productWorkFactor,
} from '@/src/core/product/productAttributes';
import {
  productMarginEur,
  productMarginPercent,
  productPurchasePriceVat0,
  productSalePriceVat0,
} from '@/src/core/product/productPricing';

/** Kaavoissa käytettävät tuoteattribuutit. Nimi on näyttöarvo, ei kaavamuuttuja. */
export const PRODUCT_FORMULA_ATTRIBUTES = [
  {
    key: 'ostohinta',
    aliases: ['purchase_price', 'yksikkohinta', 'unit_price', 'hinta'],
    label: 'Ostohinta (alv0)',
  },
  { key: 'myyntihinta', aliases: ['sale_price'], label: 'Myyntihinta (alv0)' },
  { key: 'kate', aliases: ['kate_eur', 'margin'], label: 'Kate €' },
  { key: 'kate_prosentti', aliases: ['margin_percent'], label: 'Kate %' },
  { key: 'menekki', aliases: ['consumption'], label: 'Menekki' },
  { key: 'tyokerroin', aliases: ['work_factor'], label: 'Työkerroin' },
] as const;

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

/** Täyttää kaavakontekstiin `{key}.ostohinta`, `{key}.myyntihinta`, `{key}.menekki` jne. */
export function exportProductToContext(
  fieldKey: string,
  product: Product,
  context: Record<string, number>,
): void {
  writeContextKeys(
    context,
    fieldKey,
    ['ostohinta', 'purchase_price', 'yksikkohinta', 'unit_price', 'hinta'],
    productPurchasePriceVat0(product),
  );
  writeContextKeys(context, fieldKey, ['myyntihinta', 'sale_price'], productSalePriceVat0(product));
  writeContextKeys(context, fieldKey, ['kate', 'kate_eur', 'margin'], productMarginEur(product));
  writeContextKeys(
    context,
    fieldKey,
    ['kate_prosentti', 'margin_percent'],
    productMarginPercent(product),
  );

  const consumption = productConsumption(product.attributes);
  if (consumption !== undefined) {
    writeContextKeys(context, fieldKey, ['menekki', 'consumption'], consumption);
  }

  writeContextKeys(context, fieldKey, ['tyokerroin', 'work_factor'], productWorkFactor(product.attributes));
}
