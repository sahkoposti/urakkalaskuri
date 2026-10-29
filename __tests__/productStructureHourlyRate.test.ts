jest.mock('expo-crypto', () => ({
  randomUUID: () => 'mock-uuid-hourly-rate',
}));

type MemoryStatement = {
  run: (...params: unknown[]) => { changes: number; lastInsertRowid: number | bigint };
  get: (...params: unknown[]) => Record<string, unknown> | undefined;
  all: (...params: unknown[]) => Record<string, unknown>[];
};

type MemoryDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => MemoryStatement;
};

type SqliteTestState = {
  db: MemoryDatabase | null;
  beforeOpen: ((db: MemoryDatabase) => void) | null;
};

function sqliteTestState(): SqliteTestState {
  const holder = globalThis as { __structureHourlyRateSqlite?: SqliteTestState };
  if (!holder.__structureHourlyRateSqlite) {
    holder.__structureHourlyRateSqlite = { db: null, beforeOpen: null };
  }
  return holder.__structureHourlyRateSqlite;
}

jest.mock('expo-sqlite', () => {
  // node:sqlite is available in the test runtime; @types/node is not part of the app tsconfig.
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (path: string) => MemoryDatabase;
  };

  return {
    openDatabaseAsync: async () => {
      const db = new DatabaseSync(':memory:');
      const holder = globalThis as { __structureHourlyRateSqlite?: SqliteTestState };
      if (!holder.__structureHourlyRateSqlite) {
        holder.__structureHourlyRateSqlite = { db: null, beforeOpen: null };
      }
      const state = holder.__structureHourlyRateSqlite;
      state.db = db;
      state.beforeOpen?.(db);
      return {
        execAsync: async (sql: string) => {
          db.exec(sql);
        },
        runAsync: async (sql: string, ...params: unknown[]) => {
          const result = db.prepare(sql).run(...params);
          return {
            changes: Number(result.changes),
            lastInsertRowId: Number(result.lastInsertRowid),
          };
        },
        getFirstAsync: async (sql: string, ...params: unknown[]) => {
          return db.prepare(sql).get(...params) ?? null;
        },
        getAllAsync: async (sql: string, ...params: unknown[]) => {
          return db.prepare(sql).all(...params);
        },
      };
    },
  };
});

import { createMinimalFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import { getProductStructure, resetDatabaseConnection, upsertProductStructure } from '../src/core/database/database';
import type { ProductStructure } from '../src/core/structure/types';

function rawGet(sql: string, ...params: unknown[]): Record<string, unknown> | undefined {
  const db = sqliteTestState().db;
  if (!db) throw new Error('tietokanta ei ole auki');
  return db.prepare(sql).get(...params);
}

function rawRun(sql: string, ...params: unknown[]): void {
  const db = sqliteTestState().db;
  if (!db) throw new Error('tietokanta ei ole auki');
  db.prepare(sql).run(...params);
}

function sampleStructure(hourlyRate: number | undefined): ProductStructure {
  const now = new Date('2026-01-02T00:00:00.000Z');
  return {
    id: 'rate-structure',
    name: 'Ulkoverhous',
    unit: 'm²',
    form: normalizeFormDefinition(createMinimalFormDefinition()),
    commissionPercent: 7,
    crewSize: 2,
    hourlyRate,
    marginLowAmount: 2000,
    marginLowPercent: 45,
    marginHighAmount: 10000,
    marginHighPercent: 30,
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
  };
}

describe('product structure hourly_rate', () => {
  beforeEach(() => {
    const state = sqliteTestState();
    state.beforeOpen = null;
    state.db = null;
    resetDatabaseConnection();
  });

  test('migraatio lisää hourly_rate-sarakkeen eikä kopioi Yleinen-arvoa', async () => {
    sqliteTestState().beforeOpen = (db) => {
      db.exec(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        INSERT INTO settings (key, value) VALUES ('default_hourly_rate', '99');
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
          margin_low_amount REAL,
          margin_low_percent REAL,
          margin_high_amount REAL,
          margin_high_percent REAL
        );
        INSERT INTO product_structures (
          id, name, form_json, commission_percent, sort_order, created_at, updated_at, crew_size,
          margin_low_amount, margin_low_percent, margin_high_amount, margin_high_percent
        ) VALUES (
          'legacy', 'Vanha', '{}', 7, 0, 1, 1, 2,
          2000, 45, 10000, 30
        );
      `);
    };

    const legacy = await getProductStructure('legacy');
    const columns = sqliteTestState().db?.prepare('PRAGMA table_info(product_structures)').all() ?? [];
    expect(columns.some((column) => column.name === 'hourly_rate')).toBe(true);
    expect(rawGet('SELECT hourly_rate FROM product_structures WHERE id = ?', 'legacy')?.hourly_rate).toBeNull();
    expect(legacy?.hourlyRate).toBeUndefined();

    rawRun('UPDATE product_structures SET hourly_rate = 0 WHERE id = ?', 'legacy');
    expect((await getProductStructure('legacy'))?.hourlyRate).toBeUndefined();
    rawRun('UPDATE product_structures SET hourly_rate = -4 WHERE id = ?', 'legacy');
    expect((await getProductStructure('legacy'))?.hourlyRate).toBeUndefined();
  });

  test('upsert kirjoittaa hourly_rate-arvon ja nullin, structureFromRow kierrosta', async () => {
    await upsertProductStructure(sampleStructure(42.5));
    const stored = rawGet(
      'SELECT hourly_rate FROM product_structures WHERE id = ?',
      'rate-structure',
    );
    expect(stored?.hourly_rate).toBe(42.5);
    expect((await getProductStructure('rate-structure'))?.hourlyRate).toBe(42.5);

    await upsertProductStructure(sampleStructure(undefined));
    const cleared = rawGet(
      'SELECT hourly_rate FROM product_structures WHERE id = ?',
      'rate-structure',
    );
    expect(cleared?.hourly_rate).toBeNull();
    expect((await getProductStructure('rate-structure'))?.hourlyRate).toBeUndefined();
  });
});
