/**
 * Valmis ja luonnoskirjoitus jakavat jonon. Testi ohjaa järjestyksen käsin
 * ratkaistavalla lupauksella ja lukee rivin node:sqlite-kannasta.
 * Mitään näyttöä tai koukkua ei mountata.
 */
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const ids = { n: 0 };
jest.mock('expo-crypto', () => ({
  randomUUID: () => {
    ids.n += 1;
    return `id-${ids.n}`;
  },
}));

jest.mock('../src/core/attachments/attachmentFiles', () => ({
  deleteCalculationAttachmentFolder: jest.fn(),
}));
jest.mock('../src/core/documents/documentFiles', () => ({
  deleteCalculationDocumentFolder: jest.fn(),
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

import { ensureCalculationStatusColumn } from '../src/core/database/connection';
import {
  clearWizardDraft,
  getCalculation,
  getCalculations,
  getWizardDraft,
  saveCalculation,
  saveWizardDraft,
} from '../src/core/database/database';
import { isExportBlockedByEditDraft } from '../src/core/history/detailDraftPolicy';
import type { CalculationRecord, PersistedWizardDraft } from '../src/core/models/types';
import { isDraftCalculation, wizardDraftFromCalculation } from '../src/core/wizard/draftCalculation';
import { calculationToFormState } from '../src/core/wizard/calculationToWizard';
import { createComposerSaveGate } from '../src/core/wizard/composerSaveGate';
import { buildPersistedWizardDraft } from '../src/core/wizard/wizardDraftHelpers';
import { line, record } from './pdfFixtures';

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

function finishedRecord(): CalculationRecord {
  return record({ name: 'Valmis Asiakas', phone: '040 000 0000' }, {
    id: 'fin-1',
    projectName: 'Valmis Asiakas',
    offerNumber: 10285,
    status: 'complete',
    createdAt: new Date(2026, 10, 1),
    structureLines: [line('l1', 's1', 'Ulkomaalaus')],
  });
}

function draftFrom(row: CalculationRecord, phone: string): PersistedWizardDraft {
  const { form } = calculationToFormState(row, []);
  return {
    ...buildPersistedWizardDraft(form, {
      editCalculationId: row.id,
      originalCreatedAt: row.createdAt,
      editFormVersion: row.formSnapshot?.formVersion,
    }),
    customerPhone: phone,
  };
}

async function seedFinished(): Promise<CalculationRecord> {
  await saveCalculation(finishedRecord());
  await current.runAsync('UPDATE calculations SET offer_number = 10285 WHERE id = ?', 'fin-1');
  return (await getCalculation('fin-1')) as CalculationRecord;
}

async function expectStillComplete(stored: CalculationRecord) {
  const rows = await getCalculations();
  expect(rows).toHaveLength(1);
  const row = (await getCalculation('fin-1')) as CalculationRecord;
  expect(row.id).toBe('fin-1');
  expect(row.status).toBe('complete');
  expect(isDraftCalculation(row)).toBe(false);
  expect(row.totalPriceVat).toBe(stored.totalPriceVat);
  expect(row.structureLines?.[0]?.unitPriceVat0).toBe(stored.structureLines?.[0]?.unitPriceVat0);
  expect(row.offerNumber).toBe(10285);
  expect(await getWizardDraft()).toBeNull();
  expect(isExportBlockedByEditDraft(null, 'fin-1')).toBe(false);
  expect(wizardDraftFromCalculation(row)?.customerPhone).not.toBe('0501111111');
}

describe('composer finish does not lose the completed row to a draft save', () => {
  beforeEach(async () => {
    ids.n = 0;
    current = adapt(new DatabaseSync(':memory:'));
    await current.execAsync(V3_SQL);
    await ensureCalculationStatusColumn(current);
  });

  it('keeps the row complete when a background save starts before finish and resolves after it', async () => {
    const stored = await seedFinished();
    const gate = createComposerSaveGate();
    const token = gate.capture();
    let release!: () => void;
    const io = new Promise<void>((resolve) => {
      release = resolve;
    });
    const background = (async () => {
      await io;
      return gate.commit(token, async () => {
        await saveWizardDraft(draftFrom(stored, '0501111111'));
      });
    })();

    await gate.finish(async () => {
      await saveCalculation(stored);
      await clearWizardDraft();
    });
    release();
    await expect(background).resolves.toBe(false);
    await expectStillComplete(stored);
  });

  it('drops a draft save that is queued while finish is writing', async () => {
    const stored = await seedFinished();
    const gate = createComposerSaveGate();
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered!: () => void;
    const inside = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const finished = gate.finish(async () => {
      entered();
      await hold;
      await saveCalculation(stored);
      await clearWizardDraft();
    });
    await inside;
    const token = gate.capture();
    expect(token.allowed).toBe(false);
    const queued = gate.commit(token, async () => {
      await saveWizardDraft(draftFrom(stored, '0501111111'));
    });
    release();
    await finished;
    await expect(queued).resolves.toBe(false);
    await expectStillComplete(stored);
  });

  it('keeps the row complete when an in-flight draft write is still waiting as finish starts', async () => {
    const stored = await seedFinished();
    const gate = createComposerSaveGate();
    const token = gate.capture();
    let release!: () => void;
    const io = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered!: () => void;
    const inside = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const background = gate.commit(token, async () => {
      entered();
      await io;
      await saveWizardDraft(draftFrom(stored, '0501111111'));
    });
    await inside;
    const finished = gate.finish(async () => {
      await saveCalculation(stored);
      await clearWizardDraft();
    });
    release();
    await background;
    await finished;
    await expectStillComplete(stored);
  });

  it('drafts the same id when a real edit is saved after finish', async () => {
    const stored = await seedFinished();
    const gate = createComposerSaveGate();
    await gate.finish(async () => {
      await saveCalculation(stored);
      await clearWizardDraft();
    });
    const token = gate.capture();
    expect(token.allowed).toBe(true);
    const saved = gate.commit(token, async () => {
      await saveWizardDraft(draftFrom(stored, '0409999999'));
    });
    await expect(saved).resolves.toBe(true);

    const rows = await getCalculations();
    expect(rows).toHaveLength(1);
    const row = (await getCalculation('fin-1')) as CalculationRecord;
    expect(row.id).toBe(stored.id);
    expect(row.status).toBe('draft');
    expect(isDraftCalculation(row)).toBe(true);
    expect(row.totalPriceVat).toBe(stored.totalPriceVat);
    expect(wizardDraftFromCalculation(row)?.customerPhone).toBe('0409999999');
    expect((await getWizardDraft())?.editCalculationId).toBe('fin-1');
    expect(isExportBlockedByEditDraft(await getWizardDraft(), 'fin-1')).toBe(true);
  });
});
