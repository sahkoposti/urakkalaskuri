import type * as SQLite from 'expo-sqlite';

import { step, type MigrationStep } from './types';

async function migrateProductAttributes(db: SQLite.SQLiteDatabase): Promise<void> {
  const productColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(products)');
  if (!productColumns.some((column) => column.name === 'attributes')) {
    await db.execAsync('ALTER TABLE products ADD COLUMN attributes TEXT');
  }
}

async function migrateProductPrices(db: SQLite.SQLiteDatabase): Promise<void> {
  const productColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(products)');
  if (!productColumns.some((column) => column.name === 'purchase_price_vat0')) {
    await db.execAsync('ALTER TABLE products ADD COLUMN purchase_price_vat0 REAL');
  }
  if (!productColumns.some((column) => column.name === 'sale_price_vat0')) {
    await db.execAsync('ALTER TABLE products ADD COLUMN sale_price_vat0 REAL');
  }
  await db.execAsync(`
    UPDATE products
    SET purchase_price_vat0 = unit_price_vat0
    WHERE purchase_price_vat0 IS NULL
  `);
  await db.execAsync(`
    UPDATE products
    SET sale_price_vat0 = COALESCE(purchase_price_vat0, unit_price_vat0)
    WHERE sale_price_vat0 IS NULL
  `);
}

async function migrateProductSortOrder(db: SQLite.SQLiteDatabase): Promise<void> {
  const productColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(products)');
  if (productColumns.some((column) => column.name === 'sort_order')) return;
  await db.execAsync('ALTER TABLE products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM products ORDER BY name COLLATE NOCASE ASC, id ASC',
  );
  for (let index = 0; index < rows.length; index += 1) {
    await db.runAsync('UPDATE products SET sort_order = ? WHERE id = ?', index, rows[index].id);
  }
}

export const tuotteetMigrations: MigrationStep[] = [
  step('tuotteet.migrateProductAttributes', 'tuotteet', migrateProductAttributes),
  step('tuotteet.migrateProductPrices', 'tuotteet', migrateProductPrices),
  step('tuotteet.migrateProductSortOrder', 'tuotteet', migrateProductSortOrder),
];
