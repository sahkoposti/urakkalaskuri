import * as SQLite from 'expo-sqlite';

import type {
  AppSettings,
  CalculationLine,
  CalculationRecord,
  FormSnapshot,
  PersistedWizardDraft,
  Product,
  ThemeSettings,
  WizardStepId,
} from '../models/types';
import { defaultSettings, defaultThemeSettings } from '../models/types';
import { parseProductAttributesJson } from '../product/productAttributes';
import { createDefaultFormDefinition } from '../form/defaultFormDefinition';
import { normalizeFormDefinition } from '../form/formDefinitionHelpers';
import type { FormDebugSettings, FormDefinition } from '../form/types';
import { defaultFormDebugSettings } from '../form/types';
import { normalizeWizardStepOrder } from '../wizard/wizardSteps';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Nollaa välimuistin (esim. hot reload / kuollut native-kahva Androidilla). */
export function resetDatabaseConnection(): void {
  dbPromise = null;
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

function inferVatPercent(row: Record<string, unknown>): number {
  const totalVat0 = row.total_price_vat0 as number;
  const vatAmount = row.vat_amount as number;
  if (totalVat0 <= 0 || vatAmount <= 0) {
    return defaultSettings.vatPercent;
  }
  return (vatAmount / totalVat0) * 100;
}

async function migrateDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  const calculationColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(calculations)');
  if (!calculationColumns.some((column) => column.name === 'vat_percent')) {
    await db.execAsync('ALTER TABLE calculations ADD COLUMN vat_percent REAL');
  }
  if (!calculationColumns.some((column) => column.name === 'form_snapshot')) {
    await db.execAsync('ALTER TABLE calculations ADD COLUMN form_snapshot TEXT');
  }

  const productColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(products)');
  if (!productColumns.some((column) => column.name === 'attributes')) {
    await db.execAsync('ALTER TABLE products ADD COLUMN attributes TEXT');
  }
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  // useNewConnection: Android/Expo Go voi muuten palauttaa kuolleen shared-kahvan (NPE prepareAsync).
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
  default_commission_percent: String(defaultSettings.defaultCommissionPercent),
  default_hourly_rate: String(defaultSettings.defaultHourlyRate),
  default_crew_size: String(defaultSettings.defaultCrewSize),
  workday_hours: String(defaultSettings.workdayHours),
  wizard_step_order: JSON.stringify(defaultSettings.wizardStepOrder),
  theme_accent_color: defaultSettings.theme.accentColor,
  theme_primary_color: defaultSettings.theme.primaryColor,
  theme_text_color: defaultSettings.theme.textColor,
  theme_surface_color: defaultSettings.theme.surfaceColor,
  theme_background_image_uri: defaultSettings.theme.backgroundImageUri,
  theme_background_opacity: String(defaultSettings.theme.backgroundOpacity),
};

function parseWizardStepOrder(raw?: string): WizardStepId[] {
  if (!raw) return [...defaultSettings.wizardStepOrder];
  try {
    const parsed = JSON.parse(raw) as WizardStepId[];
    return normalizeWizardStepOrder(parsed);
  } catch {
    return [...defaultSettings.wizardStepOrder];
  }
}

function parseThemeSettings(map: Record<string, string>): ThemeSettings {
  return {
    accentColor: map.theme_accent_color ?? defaultThemeSettings.accentColor,
    primaryColor: map.theme_primary_color ?? defaultThemeSettings.primaryColor,
    textColor: map.theme_text_color ?? defaultThemeSettings.textColor,
    surfaceColor: map.theme_surface_color ?? defaultThemeSettings.surfaceColor,
    backgroundImageUri: map.theme_background_image_uri ?? defaultThemeSettings.backgroundImageUri,
    backgroundOpacity: Number.parseFloat(
      map.theme_background_opacity ?? String(defaultThemeSettings.backgroundOpacity),
    ),
  };
}

function productFromRow(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    unit: row.unit as string,
    unitPriceVat0: row.unit_price_vat0 as number,
    description: (row.description as string | null) ?? undefined,
    attributes: parseProductAttributesJson(row.attributes as string | null | undefined),
    createdAt: new Date(row.created_at as number),
  };
}

function calculationFromRow(
  row: Record<string, unknown>,
  lines: CalculationLine[],
): CalculationRecord {
  return {
    id: row.id as string,
    projectName: row.project_name as string,
    customer: (row.customer as string | null) ?? undefined,
    groupDurationHours: row.group_duration_h as number,
    crewSize: row.crew_size as number,
    hourlyRate: row.hourly_rate as number,
    marginPercent: row.margin_percent as number,
    commissionPercent: row.commission_percent as number,
    contractPriceVat0: row.contract_price_vat0 as number,
    materialsVat0: row.materials_vat0 as number,
    marginEur: row.margin_eur as number,
    commissionEur: row.commission_eur as number,
    totalPriceVat0: row.total_price_vat0 as number,
    vatPercent: (row.vat_percent as number | null) ?? inferVatPercent(row),
    vatAmount: row.vat_amount as number,
    totalPriceVat: row.total_price_vat as number,
    workDurationDays: row.work_duration_days as number,
    createdAt: new Date(row.created_at as number),
    formSnapshot: parseFormSnapshot(row.form_snapshot),
    lines,
  };
}

function parseFormSnapshot(raw: unknown): FormSnapshot | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  try {
    return JSON.parse(raw) as FormSnapshot;
  } catch {
    return undefined;
  }
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    vatPercent: Number.parseFloat(map.vat_percent ?? String(defaultSettings.vatPercent)),
    defaultMarginPercent: Number.parseFloat(
      map.default_margin_percent ?? String(defaultSettings.defaultMarginPercent),
    ),
    defaultCommissionPercent: Number.parseFloat(
      map.default_commission_percent ?? String(defaultSettings.defaultCommissionPercent),
    ),
    defaultHourlyRate: Number.parseFloat(
      map.default_hourly_rate ?? String(defaultSettings.defaultHourlyRate),
    ),
    defaultCrewSize: Number.parseInt(map.default_crew_size ?? String(defaultSettings.defaultCrewSize), 10),
    workdayHours: Number.parseFloat(map.workday_hours ?? String(defaultSettings.workdayHours)),
    wizardStepOrder: parseWizardStepOrder(map.wizard_step_order),
    theme: parseThemeSettings(map),
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDb();
  const entries: Record<string, string> = {
    vat_percent: String(settings.vatPercent),
    default_margin_percent: String(settings.defaultMarginPercent),
    default_commission_percent: String(settings.defaultCommissionPercent),
    default_hourly_rate: String(settings.defaultHourlyRate),
    default_crew_size: String(settings.defaultCrewSize),
    workday_hours: String(settings.workdayHours),
    wizard_step_order: JSON.stringify(normalizeWizardStepOrder(settings.wizardStepOrder)),
    theme_accent_color: settings.theme.accentColor,
    theme_primary_color: settings.theme.primaryColor,
    theme_text_color: settings.theme.textColor,
    theme_surface_color: settings.theme.surfaceColor,
    theme_background_image_uri: settings.theme.backgroundImageUri,
    theme_background_opacity: String(settings.theme.backgroundOpacity),
  };
  for (const [key, value] of Object.entries(entries)) {
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      key,
      value,
    );
  }
}

export async function getProducts(): Promise<Product[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM products ORDER BY name COLLATE NOCASE ASC',
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
  await db.runAsync(
    `INSERT OR REPLACE INTO products (id, name, unit, unit_price_vat0, description, attributes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    product.id,
    product.name,
    product.unit,
    product.unitPriceVat0,
    product.description ?? null,
    product.attributes ? JSON.stringify(product.attributes) : null,
    product.createdAt.getTime(),
  );
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM products WHERE id = ?', id);
}

export async function getCalculations(): Promise<CalculationRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM calculations ORDER BY created_at DESC',
  );
  const records: CalculationRecord[] = [];
  for (const row of rows) {
    const lineRows = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM calculation_lines WHERE calculation_id = ?',
      row.id as string,
    );
    const lines: CalculationLine[] = lineRows.map((line) => ({
      id: line.id as string,
      productId: (line.product_id as string | null) ?? undefined,
      productName: line.product_name as string,
      unit: line.unit as string,
      unitPriceVat0: line.unit_price_vat0 as number,
      quantity: line.quantity as number,
      lineTotalVat0: line.line_total_vat0 as number,
    }));
    records.push(calculationFromRow(row, lines));
  }
  return records;
}

export async function getCalculation(id: string): Promise<CalculationRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM calculations WHERE id = ?',
    id,
  );
  if (!row) return null;
  const lineRows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM calculation_lines WHERE calculation_id = ?',
    id,
  );
  const lines: CalculationLine[] = lineRows.map((line) => ({
    id: line.id as string,
    productId: (line.product_id as string | null) ?? undefined,
    productName: line.product_name as string,
    unit: line.unit as string,
    unitPriceVat0: line.unit_price_vat0 as number,
    quantity: line.quantity as number,
    lineTotalVat0: line.line_total_vat0 as number,
  }));
  return calculationFromRow(row, lines);
}

export async function saveCalculation(record: CalculationRecord): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR REPLACE INTO calculations (
        id, project_name, customer, group_duration_h, crew_size, hourly_rate,
        margin_percent, commission_percent, contract_price_vat0, materials_vat0,
        margin_eur, commission_eur, total_price_vat0, vat_percent, vat_amount, total_price_vat,
        work_duration_days, created_at, form_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      record.projectName,
      record.customer ?? null,
      record.groupDurationHours,
      record.crewSize,
      record.hourlyRate,
      record.marginPercent,
      record.commissionPercent,
      record.contractPriceVat0,
      record.materialsVat0,
      record.marginEur,
      record.commissionEur,
      record.totalPriceVat0,
      record.vatPercent,
      record.vatAmount,
      record.totalPriceVat,
      record.workDurationDays,
      record.createdAt.getTime(),
      record.formSnapshot ? JSON.stringify(record.formSnapshot) : null,
    );
    await db.runAsync('DELETE FROM calculation_lines WHERE calculation_id = ?', record.id);
    for (const line of record.lines) {
      await db.runAsync(
        `INSERT INTO calculation_lines (
          id, calculation_id, product_id, product_name, unit,
          unit_price_vat0, quantity, line_total_vat0
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        line.id,
        record.id,
        line.productId ?? null,
        line.productName,
        line.unit,
        line.unitPriceVat0,
        line.quantity,
        line.lineTotalVat0,
      );
    }
  });
}

const WIZARD_DRAFT_ID = 'current';

export async function getWizardDraft(): Promise<PersistedWizardDraft | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM wizard_drafts WHERE id = ? LIMIT 1',
    WIZARD_DRAFT_ID,
  );
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as PersistedWizardDraft;
  } catch {
    return null;
  }
}

export async function saveWizardDraft(draft: PersistedWizardDraft): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO wizard_drafts (id, step, payload, updated_at)
     VALUES (?, ?, ?, ?)`,
    WIZARD_DRAFT_ID,
    draft.step,
    JSON.stringify(draft),
    draft.updatedAt,
  );
}

export async function clearWizardDraft(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM wizard_drafts WHERE id = ?', WIZARD_DRAFT_ID);
}

export async function getFormDefinition(): Promise<FormDefinition> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ? LIMIT 1',
    'form_definition',
  );
  if (!row) {
    const defaults = normalizeFormDefinition(createDefaultFormDefinition());
    await saveFormDefinition(defaults);
    return defaults;
  }
  try {
    return normalizeFormDefinition(JSON.parse(row.value));
  } catch {
    const defaults = normalizeFormDefinition(createDefaultFormDefinition());
    await saveFormDefinition(defaults);
    return defaults;
  }
}

export async function saveFormDefinition(form: FormDefinition): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    'form_definition',
    JSON.stringify({ ...form, updatedAt: Date.now() }),
  );
}

export async function getFormDebugSettings(): Promise<FormDebugSettings> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ? LIMIT 1',
    'form_debug',
  );
  if (!row) return { ...defaultFormDebugSettings };
  try {
    return { ...defaultFormDebugSettings, ...(JSON.parse(row.value) as FormDebugSettings) };
  } catch {
    return { ...defaultFormDebugSettings };
  }
}

export async function saveFormDebugSettings(debug: FormDebugSettings): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    'form_debug',
    JSON.stringify(debug),
  );
}
