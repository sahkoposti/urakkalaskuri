import type { Product, ProductAttributes } from '@/src/core/models/types';
import type { ProductAttributeKey } from '@/src/core/form/types';
import { parseNumber } from '@/src/core/utils/formatters';

export function productAttributeMap(product: Product): Record<ProductAttributeKey, number | undefined> {
  const attributes: ProductAttributes = product.attributes ?? {};
  return {
    unit_price: product.unitPriceVat0,
    consumption: attributes.consumption,
    purchase_price: attributes.purchasePrice,
    sale_price: attributes.salePrice,
    work_factor: attributes.workFactor,
    material_factor: attributes.materialFactor,
  };
}

export function writeProductAttributes(
  fieldKey: string,
  product: Product,
  context: Record<string, number>,
): void {
  const attributes = productAttributeMap(product);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined && Number.isFinite(value)) {
      context[`${fieldKey}.${name}`] = value;
    }
  }
}

function optionalNumber(raw: string): number | undefined {
  const parsed = parseNumber(raw.trim());
  return parsed === null ? undefined : parsed;
}

export function numberToInput(value?: number): string {
  return value === undefined ? '' : String(value).replace('.', ',');
}

export function buildProductAttributes(input: {
  consumption: string;
  purchasePrice: string;
  salePrice: string;
  workFactor: string;
  materialFactor: string;
}): ProductAttributes | undefined {
  const attributes: ProductAttributes = {
    consumption: optionalNumber(input.consumption),
    purchasePrice: optionalNumber(input.purchasePrice),
    salePrice: optionalNumber(input.salePrice),
    workFactor: optionalNumber(input.workFactor),
    materialFactor: optionalNumber(input.materialFactor),
  };
  return Object.values(attributes).some((value) => value !== undefined) ? attributes : undefined;
}
