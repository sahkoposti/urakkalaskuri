import type { Product } from '../../../core/models/types';
import { parseProductAttributesJson } from '../../../core/product/productAttributes';
import { productSortOrder } from '../../../core/product/productMutations';
import {
  parseStoredStructureIds,
  productStructureIds,
} from '../../../core/product/productStructures';
import { getDb } from '../../../core/database/connection';

function finitePrice(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function productFromRow(row: Record<string, unknown>): Product {
  const structureIds = parseStoredStructureIds(
    row.structure_ids as string | null | undefined,
    row.structure_id as string | null | undefined,
  );
  const unitPrice = finitePrice(row.unit_price_vat0) ?? 0;
  const purchasePrice = finitePrice(row.purchase_price_vat0) ?? unitPrice;
  const salePrice = finitePrice(row.sale_price_vat0) ?? purchasePrice;
  return {
    id: row.id as string,
    name: row.name as string,
    unit: row.unit as string,
    unitPriceVat0: purchasePrice,
    purchasePriceVat0: purchasePrice,
    salePriceVat0: salePrice,
    description: (row.description as string | null) ?? undefined,
    attributes: parseProductAttributesJson(row.attributes as string | null | undefined),
    structureIds,
    structureId: structureIds[0],
    sortOrder: productSortOrder({ sortOrder: finitePrice(row.sort_order) }),
    createdAt: new Date(row.created_at as number),
  };
}

export async function getProducts(): Promise<Product[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM products ORDER BY sort_order ASC, name COLLATE NOCASE ASC',
  );
  return rows.map(productFromRow);
}

export async function getProduct(id: string): Promise<Product | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM products WHERE id = ? LIMIT 1',
    id,
  );
  return row ? productFromRow(row) : null;
}

export async function upsertProduct(product: Product): Promise<void> {
  const db = await getDb();
  const structureIds = productStructureIds(product);
  const purchasePrice = product.purchasePriceVat0 ?? product.unitPriceVat0;
  const salePrice = product.salePriceVat0 ?? purchasePrice;
  await db.runAsync(
    `INSERT OR REPLACE INTO products (
      id, name, unit, unit_price_vat0, purchase_price_vat0, sale_price_vat0,
      description, attributes, created_at, structure_id, structure_ids, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    product.id,
    product.name,
    product.unit,
    purchasePrice,
    purchasePrice,
    salePrice,
    product.description ?? null,
    product.attributes ? JSON.stringify(product.attributes) : null,
    product.createdAt.getTime(),
    structureIds[0] ?? null,
    JSON.stringify(structureIds),
    productSortOrder(product),
  );
}

export async function saveProductOrder(productIds: string[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (let index = 0; index < productIds.length; index += 1) {
      await db.runAsync('UPDATE products SET sort_order = ? WHERE id = ?', index, productIds[index]);
    }
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM products WHERE id = ?', id);
}
