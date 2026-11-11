import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

import * as SQLite from 'expo-sqlite';

import * as current from '../src/core/database/connection';
import { MIGRATION_ORDER } from '../src/core/database/migrationRunner';
import * as legacy from './fixtures/legacyConnection';

type SqlDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  };
};

const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => SqlDb;
};

type TraceEntry = { sql: string; params: unknown[] };

const FIXED_NOW = Date.parse('2026-10-10T12:00:00.000Z');

function createDb() {
  const raw = new DatabaseSync(':memory:');
  const trace: TraceEntry[] = [];
  const adapter = {
    execAsync: async (sql: string) => {
      trace.push({ sql, params: [] });
      raw.exec(sql);
    },
    runAsync: async (sql: string, ...params: unknown[]) => {
      trace.push({ sql, params });
      raw.prepare(sql).run(...(params as never[]));
    },
    getFirstAsync: async (sql: string, ...params: unknown[]) => {
      trace.push({ sql, params });
      return raw.prepare(sql).get(...(params as never[])) ?? null;
    },
    getAllAsync: async (sql: string, ...params: unknown[]) => {
      trace.push({ sql, params });
      return raw.prepare(sql).all(...(params as never[]));
    },
  };
  return { raw, trace, adapter };
}

function snapshot(raw: SqlDb) {
  const master = raw
    .prepare('SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name, sql')
    .all();
  const tables = master.filter((row) => row.type === 'table').map((row) => String(row.name));
  const tableInfo: Record<string, unknown> = {};
  const rows: Record<string, unknown> = {};
  for (const table of tables) {
    tableInfo[table] = raw.prepare(`PRAGMA table_info(${table})`).all();
    rows[table] = raw.prepare(`SELECT * FROM ${table}`).all();
  }
  const version = raw.prepare('PRAGMA user_version').get();
  return { master, tableInfo, rows, version };
}

async function initWith(mod: { resetDatabaseConnection(): void; getDb(): Promise<unknown> }, adapter: object) {
  (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(adapter);
  mod.resetDatabaseConnection();
  await mod.getDb();
}

/**
 * On-disk shape of an opened 1.3.4 database.
 * Derived from origin/cursor/v134-nov7-feedback-449a (package.json version 1.3.4):
 * `git diff` of src/core/database/connection.ts against 13a0c86 is empty, and that file
 * finishes at user_version 4 with the columns below (base CREATE plus every ALTER).
 */
const V134_FIXTURE_SQL = `
PRAGMA user_version = 4;
CREATE TABLE products (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  unit_price_vat0 REAL NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  attributes TEXT,
  purchase_price_vat0 REAL,
  sale_price_vat0 REAL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  structure_id TEXT,
  structure_ids TEXT
);
CREATE TABLE calculations (
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
  created_at INTEGER NOT NULL,
  vat_percent REAL,
  form_snapshot TEXT,
  discount_percent REAL,
  discount_eur REAL,
  total_price_vat_before_discount REAL,
  total_price_vat0_before_discount REAL,
  offer_number INTEGER,
  customer_id TEXT,
  delivery_schedule_text TEXT,
  travel_time_one_way_h REAL,
  structure_lines TEXT,
  status TEXT NOT NULL DEFAULT 'complete'
);
CREATE TABLE calculation_lines (
  id TEXT PRIMARY KEY NOT NULL,
  calculation_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  unit_price_vat0 REAL NOT NULL,
  quantity REAL NOT NULL,
  line_total_vat0 REAL NOT NULL
);
CREATE TABLE settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE wizard_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  step INTEGER NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE product_structures (
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
  hourly_rate REAL,
  margin_low_amount REAL,
  margin_low_percent REAL,
  margin_high_amount REAL,
  margin_high_percent REAL
);
CREATE TABLE customers (
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
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  calculation_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('tarjous', 'urakkakortti')),
  offer_number INTEGER,
  version INTEGER NOT NULL,
  file_rel_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  inputs_json TEXT,
  summary_json TEXT,
  app_version TEXT,
  created_at TEXT NOT NULL,
  phone_save_status TEXT NOT NULL DEFAULT 'skipped',
  phone_uri TEXT,
  phone_save_error TEXT
);
CREATE TABLE attachments (
  id TEXT PRIMARY KEY NOT NULL,
  calculation_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  destination TEXT NOT NULL DEFAULT 'none',
  caption TEXT NOT NULL DEFAULT '',
  file_rel_path TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO settings (key, value) VALUES ('vat_percent', '25.5');
INSERT INTO settings (key, value) VALUES ('default_crew_size', '2');
INSERT INTO settings (key, value) VALUES ('default_commission_percent', '5');
INSERT INTO settings (key, value) VALUES ('margin_low_amount', '1000');
INSERT INTO settings (key, value) VALUES ('margin_low_percent', '10');
INSERT INTO settings (key, value) VALUES ('margin_high_amount', '5000');
INSERT INTO settings (key, value) VALUES ('margin_high_percent', '20');
INSERT INTO customers (
  id, name, customer_type, reverse_vat, phone, email, address, postal_code, postal_locality, notes, updated_at
) VALUES (
  'cust_fiktiivinen', 'Fiktiivinen Asiakas', 'private', 0, '040 111 2222', 'a@esimerkki.test',
  'Kultatie 7', '33100', 'Tampere', 'fixture', 1700000000000
);
INSERT INTO products (
  id, name, unit, unit_price_vat0, description, created_at, attributes,
  purchase_price_vat0, sale_price_vat0, sort_order, structure_id, structure_ids
) VALUES (
  'prod_nova', 'Nova 7', 'l', 45, 'kuvitteellinen', 1700000000000, NULL,
  40, 45, 0, 's1', '["s1"]'
);
INSERT INTO products (
  id, name, unit, unit_price_vat0, description, created_at, attributes,
  purchase_price_vat0, sale_price_vat0, sort_order, structure_id, structure_ids
) VALUES (
  'prod_brush', 'Pensseli', 'kpl', 12, NULL, 1700000000000, NULL,
  10, 12, 1, 's1', '["s1"]'
);
INSERT INTO product_structures (
  id, name, unit, form_json, commission_percent, sort_order, created_at, updated_at,
  crew_size, hourly_rate, margin_low_amount, margin_low_percent, margin_high_amount, margin_high_percent
) VALUES (
  's1', 'Ulkomaalaus', NULL, '{"pages":[]}', 5, 0, 1700000000000, 1700000000000,
  2, 50, 1000, 10, 5000, 20
);
INSERT INTO calculations (
  id, project_name, customer, group_duration_h, crew_size, hourly_rate, margin_percent,
  commission_percent, contract_price_vat0, materials_vat0, margin_eur, commission_eur,
  total_price_vat0, vat_amount, total_price_vat, work_duration_days, created_at,
  vat_percent, customer_id, structure_lines, status
) VALUES (
  'calc_fiktiivinen', 'Fiktiivinen Kohde', '{"name":"Fiktiivinen Asiakas"}', 10, 2, 50, 20,
  5, 1000, 200, 100, 50,
  1000, 255, 1255, 3, 1700000000000,
  25.5, 'cust_fiktiivinen', '[{"id":"line1"}]', 'complete'
);
INSERT INTO documents (
  id, calculation_id, kind, offer_number, version, file_rel_path, file_name, created_at, phone_save_status
) VALUES (
  'doc_fiktiivinen', 'calc_fiktiivinen', 'tarjous', 10420, 1, 'docs/tarjous.pdf', 'tarjous.pdf',
  '2026-10-10T12:00:00.000Z', 'skipped'
);
`;

function applyV134Fixture(raw: SqlDb) {
  raw.exec(V134_FIXTURE_SQL);
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  legacy.resetDatabaseConnection();
  current.resetDatabaseConnection();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('migration runner parity with 13a0c86 connection.ts', () => {
  it('keeps the historical global step order', () => {
    expect(MIGRATION_ORDER).toEqual([
      'core.createBaseTables',
      'laskenta.migrateCalculationColumns',
      'tuotteet.migrateProductAttributes',
      'tuotteet.migrateProductPrices',
      'tuotteet.migrateProductSortOrder',
      'core.deleteWizardStepOrderSetting',
      'laskenta.migrateProductStructures',
      'laskenta.migrateStripCustomerFormPages',
      'dokumentit.ensureDocumentsTable',
      'liitteet.ensureAttachmentsTable',
      'laskenta.ensureCalculationStatusColumn',
      'core.seedDefaultSettings',
    ]);
  });

  it('empty database: SQL trace and resulting schema/data match the legacy init', async () => {
    const left = createDb();
    const right = createDb();
    await initWith(legacy, left.adapter);
    await initWith(current, right.adapter);
    expect(right.trace).toEqual(left.trace);
    expect(snapshot(right.raw)).toEqual(snapshot(left.raw));
  });

  it('1.3.4-shaped database: SQL trace and resulting schema/data match, and a second new init is idempotent', async () => {
    const left = createDb();
    const right = createDb();
    applyV134Fixture(left.raw);
    applyV134Fixture(right.raw);
    await initWith(legacy, left.adapter);
    await initWith(current, right.adapter);
    expect(right.trace).toEqual(left.trace);
    const after = snapshot(right.raw);
    expect(after).toEqual(snapshot(left.raw));
    expect(after.version).toEqual({ user_version: 4 });

    const beforeSecond = snapshot(right.raw);
    right.trace.length = 0;
    await initWith(current, right.adapter);
    expect(snapshot(right.raw)).toEqual(beforeSecond);
  });

  it('already-migrated database: second init traces match and data is unchanged', async () => {
    const left = createDb();
    const right = createDb();
    await initWith(legacy, left.adapter);
    await initWith(current, right.adapter);
    const leftAfterFirst = snapshot(left.raw);
    const rightAfterFirst = snapshot(right.raw);
    left.trace.length = 0;
    right.trace.length = 0;
    await initWith(legacy, left.adapter);
    await initWith(current, right.adapter);
    expect(right.trace).toEqual(left.trace);
    expect(snapshot(left.raw)).toEqual(leftAfterFirst);
    expect(snapshot(right.raw)).toEqual(rightAfterFirst);
  });
});

describe('migration SQL text', () => {
  it('keeps every SQL literal from 13a0c86 connection.ts', () => {
    const oldSource = execSync('git show 13a0c86:src/core/database/connection.ts', { encoding: 'utf8' });
    const literals = [...oldSource.matchAll(/`(?:\\`|[^`])*`|'(?:\\'|[^'])*'/gs)]
      .map((match) => match[0].slice(1, -1))
      .filter((text) => /CREATE|ALTER|UPDATE|INSERT|DELETE|PRAGMA|SELECT/i.test(text));
    const dir = path.join(__dirname, '../src/core/database');
    const files = walk(dir).filter((file) => file.endsWith('.ts'));
    const combined = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    const missing = literals.filter((text) => !combined.includes(text));
    expect(missing).toEqual([]);
    expect(literals.length).toBeGreaterThan(10);
  });
});

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, acc);
    else acc.push(abs);
  }
  return acc;
}
