import type * as SQLite from 'expo-sqlite';

import { createDefaultFormDefinition } from '../../form/defaultFormDefinition';
import { isCustomerFormPage, normalizeFormDefinition } from '../../form/formDefinitionHelpers';
import { defaultSettings, parseCustomerDetails } from '../../models/types';
import { structureLineFromLegacyRecord } from '../../structure/legacyCalculation';
import { DEFAULT_STRUCTURE_ID } from '../../structure/types';
import { ACTIVE_STRUCTURE_KEY, inferVatPercent, parseFormSnapshot } from '../rowParsers';

import { step, type DocumentsDb, type MigrationStep } from './types';

async function migrateCalculationColumns(db: SQLite.SQLiteDatabase): Promise<void> {
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
  if (!calculationColumns.some((column) => column.name === 'offer_number')) {
    await db.execAsync('ALTER TABLE calculations ADD COLUMN offer_number INTEGER');
  }
}

/**
 * Laskelman tila. user_version 4 lisää `calculations.status`.
 * Oletus `complete`, joten vanhat rivit säilyvät valmiina. Nosto on idempotentti.
 */
export const CALCULATION_STATUS_SCHEMA_VERSION = 4;

/** `status`-sarake. Turvallista ajaa kahdesti ja jos sarake on jo olemassa. */
export async function ensureCalculationStatusColumn(db: DocumentsDb): Promise<void> {
  const columns = await db.getAllAsync('PRAGMA table_info(calculations)');
  const names = columns.map((column) => String(column.name ?? ''));
  if (names.length > 0 && !names.includes('status')) {
    await db.execAsync("ALTER TABLE calculations ADD COLUMN status TEXT NOT NULL DEFAULT 'complete'");
  }
  const row = await db.getFirstAsync('PRAGMA user_version');
  const current = Number(row?.user_version ?? 0);
  if (!Number.isFinite(current) || current < CALCULATION_STATUS_SCHEMA_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${CALCULATION_STATUS_SCHEMA_VERSION}`);
  }
}

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
      crew_size REAL,
      hourly_rate REAL
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
  if (!names.has('hourly_rate')) {
    await db.execAsync('ALTER TABLE product_structures ADD COLUMN hourly_rate REAL');
  }
  if (!names.has('margin_low_amount')) {
    await db.execAsync('ALTER TABLE product_structures ADD COLUMN margin_low_amount REAL');
  }
  if (!names.has('margin_low_percent')) {
    await db.execAsync('ALTER TABLE product_structures ADD COLUMN margin_low_percent REAL');
  }
  if (!names.has('margin_high_amount')) {
    await db.execAsync('ALTER TABLE product_structures ADD COLUMN margin_high_amount REAL');
  }
  if (!names.has('margin_high_percent')) {
    await db.execAsync('ALTER TABLE product_structures ADD COLUMN margin_high_percent REAL');
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

  const marginLowAmount = await readSettingNumber(
    db,
    'margin_low_amount',
    defaultSettings.marginLowAmount,
  );
  const marginLowPercent = await readSettingNumber(
    db,
    'margin_low_percent',
    defaultSettings.marginLowPercent,
  );
  const marginHighAmount = await readSettingNumber(
    db,
    'margin_high_amount',
    defaultSettings.marginHighAmount,
  );
  const marginHighPercent = await readSettingNumber(
    db,
    'margin_high_percent',
    defaultSettings.marginHighPercent,
  );
  await db.runAsync(
    `UPDATE product_structures
     SET margin_low_amount = ?,
         margin_low_percent = ?,
         margin_high_amount = ?,
         margin_high_percent = ?
     WHERE margin_low_amount IS NULL
        OR margin_low_amount <= 0
        OR margin_low_percent IS NULL
        OR margin_high_amount IS NULL
        OR margin_high_amount <= 0
        OR margin_high_percent IS NULL`,
    marginLowAmount,
    marginLowPercent,
    marginHighAmount,
    marginHighPercent,
  );
}

async function readSettingNumber(
  db: SQLite.SQLiteDatabase,
  key: string,
  fallback: number,
): Promise<number> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ? LIMIT 1',
    key,
  );
  const parsed = Number.parseFloat(row?.value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
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

export const laskentaMigrations: MigrationStep[] = [
  step('laskenta.migrateCalculationColumns', 'laskenta', migrateCalculationColumns),
  step('laskenta.migrateProductStructures', 'laskenta', migrateProductStructures),
  step('laskenta.migrateStripCustomerFormPages', 'laskenta', migrateStripCustomerFormPages),
  step('laskenta.ensureCalculationStatusColumn', 'laskenta', ensureCalculationStatusColumn),
];
