import type { Product } from '@/src/core/models/types';
import { roundToCents } from '@/src/core/utils/formatters';

export type ProductPriceSource = Pick<
  Product,
  'unitPriceVat0' | 'purchasePriceVat0' | 'salePriceVat0' | 'attributes'
>;

function finitePrice(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function productPurchasePriceVat0(product: ProductPriceSource): number {
  return (
    finitePrice(product.purchasePriceVat0) ??
    finitePrice(product.attributes?.purchase_price) ??
    finitePrice(product.unitPriceVat0) ??
    0
  );
}

export function productSalePriceVat0(product: ProductPriceSource): number {
  return (
    finitePrice(product.salePriceVat0) ??
    finitePrice(product.attributes?.sale_price) ??
    productPurchasePriceVat0(product)
  );
}

export function productMarginEur(product: ProductPriceSource): number {
  return roundToCents(productSalePriceVat0(product) - productPurchasePriceVat0(product));
}

/** Kate myyntihinnasta: (myynti − osto) / myynti × 100. */
export function productMarginPercent(product: ProductPriceSource): number {
  const sale = productSalePriceVat0(product);
  if (!(sale > 0)) return 0;
  return (productMarginEur(product) / sale) * 100;
}

export function withProductPrices(
  product: Product,
  purchasePriceVat0: number,
  salePriceVat0: number,
): Product {
  return {
    ...product,
    purchasePriceVat0,
    salePriceVat0,
    unitPriceVat0: purchasePriceVat0,
  };
}
