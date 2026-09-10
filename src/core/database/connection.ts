import * as SQLite from 'expo-sqlite';

import type { FormSnapshot, StructureLine } from '../models/types';
import { defaultSettings, parseCustomerDetails } from '../models/types';
import { createDefaultFormDefinition } from '../form/defaultFormDefinition';
import { isCustomerFormPage, normalizeFormDefinition } from '../form/formDefinitionHelpers';
import { structureLineFromLegacyRecord } from '../structure/legacyCalculation';
import { withDerivedLinePricing } from '../structure/linePricing';
import { DEFAULT_STRUCTURE_ID } from '../structure/types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const ACTIVE_STRUCTURE_KEY = 'active_structure_id';

/** Nollaa välimuistin (esim. hot reload / kuollut native-kahva Androidilla). */
export function resetDatabaseConnection(): void {
  dbPromise = null;
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

export function inferVatPercent(row: Record<string, unknown>): number {
  const totalVat0 = row.total_price_vat0 as number;
  const vatAmount = row.vat_amount as number;
  if (totalVat0 <= 0 || vatAmount <= 0) {
    return defaultSettings.vatPercent;
  }
  return (vatAmount / totalVat0) * 100;
}

export function parseFormSnapshot(raw: unknown): FormSnapshot | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  try {
    return JSON.parse(raw) as FormSnapshot;
  } catch {
    return undefined;
  }
}

export function parseStructureLines(raw: unknown): StructureLine[] | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as StructureLine[];
    if (!Array.isArray(parsed) || parsed.length === 0) return undefined;
    return parsed.map((line) => withDerivedLinePricing(line));
  } catch {
    return undefined;
  }
}

async function migrateDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  const calculationColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(calculations)');
  if (!calculationColumns.some((column) => column.name === 'vat_percent')) {
    await db.execAsync('ALTER TABLE calculations ADD COLUMN vat_percent REAL');
  }
  if (!calculationColumns.some((column) => column.name === 'form_snapshot')) {
    await db.execAsync('ALTER TABLE calculations ADD COLUMN form_snapshot TEXT');
  }
  if (!calculationColumns.some((column) => column.name === 'discount_percent')) {
    await db.execAsync('ALTER TABLE calculations ADD COLUMN discount_percent REAL');
  }
  if (!calculationColumns.some((column) => column.name === 'discount_eur')) {
    await db.execAsync('ALTER TABLE calculations ADD COLUMN discount_eur REAL');
  }
  if (!calculationColumns.some((column) => column.name === 'total_price_vat_before_discount')) {
    await db.execAsync('ALTER TABLE calculations ADD COLUMN total_price_vat_before_discount REAL');
  }
  if (!calculationColumns.some((column) => column.name === 'total_price_vat0_before_discount')) {
    await db.execAsync('ALTER TABLE calculations ADD COLUMN total_price_vat0_before_discount REAL');
  }

  const productColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(products)');
  if (!productColumns.some((column) => column.name === 'attributes')) {
    await db.execAsync('ALTER TABLE products ADD COLUMN attributes TEXT');
  }
  await migrateProductPrices(db);
  await migrateProductSortOrder(db);

  await db.runAsync('DELETE FROM settings WHERE key = ?', 'wizard_step_order');
  await migrateProductStructures(db);
  await migrateStripCustomerFormPages(db);
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

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('urakkalaskuri.db', {
    useNewConnection: true,
  });
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      unit_price_vat0 REAL NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS calculations (
      id TEXT PRIMARY KEY NOT NULL,
      project_name TEXT NOT NULL,
      customer TEXT,
      group_duration_h REAL NOT NULL,
      crew_size INTEGER NOT NULL,
      hourly_rate REAL NOT NULL,
      margin_percent REAL NOT NULL,
      commission_percent REAL NOT NULL,
      contract_price_vat0 REAL NOT NULL,
      materials_vat0 REAL NOT NULL,
      margin_eur REAL NOT NULL,
      commission_eur REAL NOT NULL,
      total_price_vat0 REAL NOT NULL,
      vat_amount REAL NOT NULL,
      total_price_vat REAL NOT NULL,
      work_duration_days REAL NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS calculation_lines (
      id TEXT PRIMARY KEY NOT NULL,
      calculation_id TEXT NOT NULL,
      product_id TEXT,
      product_name TEXT NOT NULL,
      unit TEXT NOT NULL,
      unit_price_vat0 REAL NOT NULL,
      quantity REAL NOT NULL,
      line_total_vat0 REAL NOT NULL,
      FOREIGN KEY (calculation_id) REFERENCES calculations(id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wizard_drafts (
      id TEXT PRIMARY KEY NOT NULL,
      step INTEGER NOT NULL,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await migrateDatabase(db);

  const settingsCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM settings',
  );
  if ((settingsCount?.count ?? 0) === 0) {
    for (const [key, value] of Object.entries(defaultSettingRows)) {
      await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', key, value);
    }
  }

  return db;
}

const defaultSettingRows: Record<string, string> = {
  vat_percent: String(defaultSettings.vatPercent),
  default_margin_percent: String(defaultSettings.defaultMarginPercent),
  margin_low_amount: String(defaultSettings.marginLowAmount),
  margin_low_percent: String(defaultSettings.marginLowPercent),
  margin_high_amount: String(defaultSettings.marginHighAmount),
  margin_high_percent: String(defaultSettings.marginHighPercent),
  default_commission_percent: String(defaultSettings.defaultCommissionPercent),
  default_hourly_rate: String(defaultSettings.defaultHourlyRate),
  default_crew_size: String(defaultSettings.defaultCrewSize),
  workday_hours: String(defaultSettings.workdayHours),
  weather_reserve_factor: String(defaultSettings.weatherReserveFactor),
  theme_accent_color: defaultSettings.theme.accentColor,
  theme_primary_color: defaultSettings.theme.primaryColor,
  theme_text_color: defaultSettings.theme.textColor,
  theme_surface_color: defaultSettings.theme.surfaceColor,
  theme_background_image_uri: defaultSettings.theme.backgroundImageUri,
  theme_background_opacity: String(defaultSettings.theme.backgroundOpacity),
};

async function migrateProductStructures(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS product_structures (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      unit TEXT,
      form_json TEXT NOT NULL,
      commission_percent REAL NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      default_additional_info TEXT,
      default_unit_price_vat0 REAL,
      default_contract_price_vat0 REAL,
      default_materials_vat0 REAL,
      default_display_work_duration_days INTEGER,
      crew_size REAL
    );
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      customer_type TEXT NOT NULL,
      reverse_vat INTEGER NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      postal_code TEXT,
      postal_locality TEXT,
      notes TEXT,
      updated_at INTEGER NOT NULL
    );
  `);

  const productColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(products)');
  if (!productColumns.some((column) => column.name === 'structure_id')) {
    await db.execAsync('ALTER TABLE products ADD COLUMN structure_id TEXT');
  }
  if (!productColumns.some((column) => column.name === 'structure_ids')) {
    await db.execAsync('ALTER TABLE products ADD COLUMN structure_ids TEXT');
  }

  const calculationColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(calculations)',
  );
  if (!calculationColumns.some((column) => column.name === 'customer_id')) {
    await db.execAsync('ALTER TABLE calculations ADD COLUMN customer_id TEXT');
  }
  if (!calculationColumns.some((column) => column.name === 'delivery_schedule_text')) {
    await db.execAsync('ALTER TABLE calculations ADD COLUMN delivery_schedule_text TEXT');
  }
  if (!calculationColumns.some((column) => column.name === 'travel_time_one_way_h')) {
    await db.execAsync('ALTER TABLE calculations ADD COLUMN travel_time_one_way_h REAL');
  }
  if (!calculationColumns.some((column) => column.name === 'structure_lines')) {
    await db.execAsync('ALTER TABLE calculations ADD COLUMN structure_lines TEXT');
  }

  const structureCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM product_structures',
  );
  if ((structureCount?.count ?? 0) === 0) {
    const formRow = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ? LIMIT 1',
      'form_definition',
    );
    let form = normalizeFormDefinition(createDefaultFormDefinition());
    if (formRow?.value) {
      try {
        form = normalizeFormDefinition(JSON.parse(formRow.value));
      } catch {
        form = normalizeFormDefinition(createDefaultFormDefinition());
      }
    }
    const settingsRow = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ? LIMIT 1',
      'default_commission_percent',
    );
    const commission = Number.parseFloat(
      settingsRow?.value ?? String(defaultSettings.defaultCommissionPercent),
    );
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO product_structures (
        id, name, unit, form_json, commission_percent, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      DEFAULT_STRUCTURE_ID,
      form.name || 'Julkisivumaalaus',
      null,
      JSON.stringify(form),
      Number.isFinite(commission) ? commission : defaultSettings.defaultCommissionPercent,
      0,
      now,
      now,
    );
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      ACTIVE_STRUCTURE_KEY,
      DEFAULT_STRUCTURE_ID,
    );
  }

  await migrateProductStructureDefaults(db);

  await db.runAsync(
    `UPDATE products SET structure_id = ? WHERE structure_id IS NULL OR structure_id = ''`,
    DEFAULT_STRUCTURE_ID,
  );

  const calcRows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM calculations',
  );
  const customerByName = new Map<string, string>();
  const existingCustomers = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM customers');
  for (const row of existingCustomers) {
    customerByName.set((row.name as string).trim().toLocaleLowerCase('fi'), row.id as string);
  }

  for (const row of calcRows) {
    const name = String(row.project_name ?? '').trim();
    let customerId = (row.customer_id as string | null) ?? null;
    if (!customerId && name) {
      const key = name.toLocaleLowerCase('fi');
      customerId = customerByName.get(key) ?? null;
      if (!customerId) {
        customerId = `migrated_${key.replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}_${row.id}`;
        const details = parseCustomerDetails((row.customer as string | null) ?? undefined);
        await db.runAsync(
          `INSERT INTO customers (
            id, name, customer_type, reverse_vat, phone, email, address,
            postal_code, postal_locality, notes, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          customerId,
          name,
          details.customerType ?? 'private',
          details.reverseVat ? 1 : 0,
          details.phone ?? null,
          details.email ?? null,
          details.address ?? null,
          details.postalCode ?? null,
          details.postalLocality ?? null,
          details.notes ?? null,
          Date.now(),
        );
        customerByName.set(key, customerId);
      }
      await db.runAsync(
        'UPDATE calculations SET customer_id = ? WHERE id = ?',
        customerId,
        row.id as string,
      );
    }

    if (!row.structure_lines) {
      const snapshot = parseFormSnapshot(row.form_snapshot);
      const nameRow = await db.getFirstAsync<{ name: string }>(
        'SELECT name FROM product_structures WHERE id = ? LIMIT 1',
        DEFAULT_STRUCTURE_ID,
      );
      const line = structureLineFromLegacyRecord(
        {
          id: row.id as string,
          contractPriceVat0: row.contract_price_vat0 as number,
          materialsVat0: row.materials_vat0 as number,
          discountPercent: (row.discount_percent as number | null) ?? 0,
          vatPercent: (row.vat_percent as number | null) ?? inferVatPercent(row),
          workDurationDays: row.work_duration_days as number,
          commissionPercent: row.commission_percent as number,
          commissionEur: row.commission_eur as number,
          marginEur: row.margin_eur as number,
          marginPercent: row.margin_percent as number,
          totalPriceVat0BeforeDiscount:
            (row.total_price_vat0_before_discount as number | null) ??
            (row.total_price_vat0 as number),
          formSnapshot: snapshot,
        },
        nameRow?.name ?? 'Laskenta',
        DEFAULT_STRUCTURE_ID,
      );
      await db.runAsync(
        'UPDATE calculations SET structure_lines = ? WHERE id = ?',
        JSON.stringify([line]),
        row.id as string,
      );
    }
  }
}

async function migrateProductStructureDefaults(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(product_structures)');
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('default_additional_info')) {
    await db.execAsync('ALTER TABLE product_structures ADD COLUMN default_additional_info TEXT');
  }
  if (!names.has('default_unit_price_vat0')) {
    await db.execAsync('ALTER TABLE product_structures ADD COLUMN default_unit_price_vat0 REAL');
  }
  if (!names.has('default_contract_price_vat0')) {
    await db.execAsync('ALTER TABLE product_structures ADD COLUMN default_contract_price_vat0 REAL');
  }
  if (!names.has('default_materials_vat0')) {
    await db.execAsync('ALTER TABLE product_structures ADD COLUMN default_materials_vat0 REAL');
  }
  if (!names.has('default_display_work_duration_days')) {
    await db.execAsync(
      'ALTER TABLE product_structures ADD COLUMN default_display_work_duration_days INTEGER',
    );
  }
  if (!names.has('crew_size')) {
    await db.execAsync('ALTER TABLE product_structures ADD COLUMN crew_size REAL');
  }
  const crewFallback = Number.parseFloat(String(defaultSettings.defaultCrewSize));
  const settingsCrew = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ? LIMIT 1',
    'default_crew_size',
  );
  const migratedCrew = Number.parseFloat(settingsCrew?.value ?? '');
  const crewSize =
    Number.isFinite(migratedCrew) && migratedCrew > 0
      ? migratedCrew
      : Number.isFinite(crewFallback) && crewFallback > 0
        ? crewFallback
        : 2;
  await db.runAsync(
    'UPDATE product_structures SET crew_size = ? WHERE crew_size IS NULL OR crew_size <= 0',
    crewSize,
  );
}

function rawFormHasCustomerPage(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const pages = (raw as { pages?: { id?: string; system?: string }[] }).pages;
  if (!Array.isArray(pages)) return false;
  return pages.some((page) =>
    isCustomerFormPage({ id: page.id ?? '', system: page.system as 'customer' | 'materials' | undefined }),
  );
}

async function migrateStripCustomerFormPages(db: SQLite.SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ id: string; form_json: string }>(
    'SELECT id, form_json FROM product_structures',
  );
  const now = Date.now();
  for (const row of rows) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.form_json);
    } catch {
      continue;
    }
    if (!rawFormHasCustomerPage(parsed)) continue;
    await db.runAsync(
      'UPDATE product_structures SET form_json = ?, updated_at = ? WHERE id = ?',
      JSON.stringify(normalizeFormDefinition(parsed)),
      now,
      row.id,
    );
  }

  const settingsRow = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ? LIMIT 1',
    'form_definition',
  );
  if (!settingsRow?.value) return;
  try {
    const parsed = JSON.parse(settingsRow.value);
    if (!rawFormHasCustomerPage(parsed)) return;
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      'form_definition',
      JSON.stringify(normalizeFormDefinition(parsed)),
    );
  } catch {
    /* säilytä vanha rivi jos JSON on rikki */
  }
}
