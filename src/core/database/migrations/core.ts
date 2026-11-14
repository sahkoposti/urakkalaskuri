import type * as SQLite from 'expo-sqlite';

import { defaultSettings } from '../../models/types';

import { step, type MigrationStep } from './types';

async function createBaseTables(db: SQLite.SQLiteDatabase): Promise<void> {
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
}

async function deleteWizardStepOrderSetting(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM settings WHERE key = ?', 'wizard_step_order');
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

async function seedDefaultSettings(db: SQLite.SQLiteDatabase): Promise<void> {
  const settingsCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM settings',
  );
  if ((settingsCount?.count ?? 0) === 0) {
    for (const [key, value] of Object.entries(defaultSettingRows)) {
      await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', key, value);
    }
  }
}

export const coreMigrations: MigrationStep[] = [
  step('core.createBaseTables', 'core', createBaseTables),
  step('core.deleteWizardStepOrderSetting', 'core', deleteWizardStepOrderSetting),
  step('core.seedDefaultSettings', 'core', seedDefaultSettings),
];
