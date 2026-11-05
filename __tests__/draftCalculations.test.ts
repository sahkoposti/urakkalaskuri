jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const ids = { n: 0 };
jest.mock('expo-crypto', () => ({
  randomUUID: () => {
    ids.n += 1;
    return `id-${ids.n}`;
  },
}));

jest.mock('../src/core/attachments/attachmentFiles', () => ({
  deleteCalculationAttachmentFolder: () => undefined,
}));
jest.mock('../src/core/documents/documentFiles', () => ({
  deleteCalculationDocumentFolder: () => undefined,
}));

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

function adapt(db: SqlDb) {
  return {
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    runAsync: async (sql: string, ...args: unknown[]) => {
      db.prepare(sql).run(...args);
    },
    getFirstAsync: async (sql: string, ...args: unknown[]) => db.prepare(sql).get(...args) ?? null,
    getAllAsync: async (sql: string, ...args: unknown[]) => db.prepare(sql).all(...args),
    withTransactionAsync: async (fn: () => Promise<void>) => {
      await fn();
    },
  };
}

let current: ReturnType<typeof adapt>;

jest.mock('../src/core/database/connection', () => {
  const actual = jest.requireActual('../src/core/database/connection') as Record<string, unknown>;
  return {
    ...actual,
    getDb: async () => current,
  };
});

import { CALCULATION_STATUS_SCHEMA_VERSION, ensureCalculationStatusColumn } from '../src/core/database/connection';
import {
  beginNewCalculation,
  deleteCalculation,
  getCalculation,
  getCalculations,
  getWizardDraft,
  promoteCurrentWizardDraft,
  saveCalculation,
  saveWizardDraft,
} from '../src/core/database/database';
import type { PersistedWizardDraft } from '../src/core/models/types';
import {
  completeCalculations,
  draftCalculationFromWizard,
  isDraftCalculation,
  wizardDraftFromCalculation,
} from '../src/core/wizard/draftCalculation';
import { record } from './pdfFixtures';

const V3_SQL = `
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
  structure_lines TEXT
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
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  calculation_id TEXT NOT NULL
);
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  calculation_id TEXT NOT NULL
);
CREATE TABLE wizard_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  step INTEGER NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

function session(name: string, updatedAt: number): PersistedWizardDraft {
  return {
    step: 0,
    customerName: name,
    customerType: 'private',
    reverseVat: false,
    customerPhone: '0401234567',
    customerEmail: '',
    customerAddress: 'Kuvitteellinen 1',
    customerNotes: 'Luonnos',
    duration: '',
    lines: [],
    updatedAt,
    structureLines: [],
  };
}

describe('draft calculations', () => {
  beforeEach(() => {
    ids.n = 0;
    current = adapt(new DatabaseSync(':memory:'));
  });

  it('keeps finished rows complete and promotes the current wizard draft', async () => {
    await current.execAsync(V3_SQL);
    await current.execAsync('PRAGMA user_version = 3');
    await current.runAsync(
      `INSERT INTO calculations (
        id, project_name, group_duration_h, crew_size, hourly_rate, margin_percent, commission_percent,
        contract_price_vat0, materials_vat0, margin_eur, commission_eur, total_price_vat0, vat_amount,
        total_price_vat, work_duration_days, created_at, offer_number
      ) VALUES ('fin-1', 'Valmis A', 1, 1, 40, 10, 0, 100, 0, 10, 0, 110, 25.3, 135.3, 1, 1000, 7)`,
    );
    await current.runAsync(
      `INSERT INTO calculations (
        id, project_name, group_duration_h, crew_size, hourly_rate, margin_percent, commission_percent,
        contract_price_vat0, materials_vat0, margin_eur, commission_eur, total_price_vat0, vat_amount,
        total_price_vat, work_duration_days, created_at
      ) VALUES ('fin-2', 'Valmis B', 2, 2, 40, 10, 0, 200, 0, 20, 0, 220, 50.6, 270.6, 2, 2000)`,
    );
    const leftover = session('Keskeneräinen Malli', 5000);
    await current.runAsync(
      `INSERT INTO wizard_drafts (id, step, payload, updated_at) VALUES ('current', 0, ?, 5000)`,
      JSON.stringify(leftover),
    );

    await ensureCalculationStatusColumn(current);
    await ensureCalculationStatusColumn(current);
    expect((await current.getFirstAsync('PRAGMA user_version'))?.user_version).toBe(CALCULATION_STATUS_SCHEMA_VERSION);
    const statuses = await current.getAllAsync('SELECT id, project_name, status, offer_number FROM calculations ORDER BY id');
    expect(statuses).toEqual([
      { id: 'fin-1', project_name: 'Valmis A', status: 'complete', offer_number: 7 },
      { id: 'fin-2', project_name: 'Valmis B', status: 'complete', offer_number: null },
    ]);

    const promotedId = await promoteCurrentWizardDraft();
    expect(promotedId).toBe('id-1');
    const again = await promoteCurrentWizardDraft();
    expect(again).toBe('id-1');
    const rows = await getCalculations();
    expect(rows.filter((row) => !isDraftCalculation(row)).map((row) => row.id).sort()).toEqual(['fin-1', 'fin-2']);
    const draft = rows.find((row) => row.id === 'id-1');
    expect(draft?.status).toBe('draft');
    expect(draft?.projectName).toBe('Keskeneräinen Malli');
    expect(draft && wizardDraftFromCalculation(draft)?.customerName).toBe('Keskeneräinen Malli');
    expect((await getWizardDraft())?.editCalculationId).toBe('id-1');

    await beginNewCalculation();
    expect(await getWizardDraft()).toBeNull();
    expect((await getCalculations()).some((row) => row.id === 'id-1' && row.status === 'draft')).toBe(true);

    const second = draftCalculationFromWizard(session('Toinen luonnos', 6000), 'draft-2', new Date(6000));
    await saveCalculation(second);
    const listed = await getCalculations();
    const drafts = listed.filter((row) => isDraftCalculation(row));
    expect(drafts.map((row) => row.projectName).sort()).toEqual(['Keskeneräinen Malli', 'Toinen luonnos']);
    expect(completeCalculations(listed)).toHaveLength(2);

    const finished = {
      ...record({ name: 'Toinen luonnos' }),
      id: 'draft-2',
      createdAt: new Date(6000),
      status: 'complete' as const,
    };
    await saveCalculation(finished);
    const afterFinish = await getCalculations();
    expect(afterFinish.filter((row) => row.id === 'draft-2')).toHaveLength(1);
    expect(afterFinish.find((row) => row.id === 'draft-2')?.status).toBe('complete');

    await deleteCalculation('id-1');
    expect(await getCalculation('id-1')).toBeNull();
    expect((await getCalculations()).some((row) => row.id === 'id-1')).toBe(false);
  });

  it('does not lower a newer schema version when the column already exists', async () => {
    await current.execAsync(V3_SQL);
    await current.execAsync("ALTER TABLE calculations ADD COLUMN status TEXT NOT NULL DEFAULT 'complete'");
    await current.execAsync('PRAGMA user_version = 9');
    await ensureCalculationStatusColumn(current);
    expect((await current.getFirstAsync('PRAGMA user_version'))?.user_version).toBe(9);
  });
});
