import type { FormDefinition, FormField } from '@/src/core/form/types';
import type { Product } from '@/src/core/models/types';
import { productBelongsToStructure } from '@/src/core/product/productStructures';

import { resolveFieldRawValue } from '@/src/core/form/fieldDefaultValue';

export function isProductField(field: Pick<FormField, 'type'>): boolean {
  return field.type === 'product_select';
}

export function getSelectedProductId(
  fieldValues: Record<string, string>,
  fieldKey: string,
  field?: Pick<FormField, 'key' | 'defaultValue'>,
): string | null {
  const raw = field
    ? resolveFieldRawValue({ key: fieldKey, defaultValue: field.defaultValue }, fieldValues)
    : fieldValues[fieldKey];
  const productId = raw?.trim();
  return productId || null;
}

function normalizeProductName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fi');
}

function compactProductName(value: string): string {
  return normalizeProductName(value).replace(/ /g, '');
}

/** Tuotehaku nimellä: täsmäys, välilyönnit ja yksilöllinen osanimi. */
export function searchProductsByName(products: Product[], query: string): Product[] {
  const needle = normalizeProductName(query);
  if (!needle) return [];
  const compactNeedle = compactProductName(query);
  return products.filter((product) => {
    const name = normalizeProductName(product.name);
    const compact = compactProductName(product.name);
    return name === needle || compact === compactNeedle || name.includes(needle) || compact.includes(compactNeedle);
  });
}

/** Hakee tuotteen id:llä tai tuotehaulla (nimi, esim. Henkilönostin Dino180). */
export function findProductById(products: Product[], productId: string | null | undefined): Product | null {
  if (!productId) return null;
  const needle = productId.trim();
  if (!needle) return null;
  const byId = products.find((product) => product.id === needle);
  if (byId) return byId;

  const hits = searchProductsByName(products, needle);
  if (hits.length === 0) return null;
  const exact = hits.find((product) => normalizeProductName(product.name) === normalizeProductName(needle));
  if (exact) return exact;
  const compact = hits.find(
    (product) => compactProductName(product.name) === compactProductName(needle),
  );
  if (compact) return compact;
  return hits.length === 1 ? hits[0] : null;
}

/** Pickerin arvo on aina tuote-id, vaikka oletus olisi tuotteen nimi. */
export function selectedProductPickerValue(
  products: Product[],
  productIdOrName: string | null | undefined,
): string {
  return findProductById(products, productIdOrName)?.id ?? '';
}

/**
 * Rakenteen tuotteet + lomakkeen product_select-oletusnimellä löytyvät tuotteet.
 * Oletustuotehaku (esim. Henkilönostin Dino180) toimii koko rekisterissä.
 */
export function productsForStructureForm(
  form: Pick<FormDefinition, 'fields'>,
  products: Product[],
  structureId?: string,
): Product[] {
  const structureProducts = structureId
    ? products.filter((product) => productBelongsToStructure(product, structureId))
    : [...products];
  const seen = new Set(structureProducts.map((product) => product.id));
  const merged = [...structureProducts];
  for (const field of form.fields) {
    if (!isProductField(field)) continue;
    const found = findProductById(products, field.defaultValue);
    if (found && !seen.has(found.id)) {
      seen.add(found.id);
      merged.push(found);
    }
  }
  return merged;
}
