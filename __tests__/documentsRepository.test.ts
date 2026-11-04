jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));

const removedFiles: string[] = [];
const removedFolders: string[] = [];

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('../src/core/documents/documentFiles', () => ({
  removeStoredPdf: (path: string) => {
    removedFiles.push(path);
  },
  deleteCalculationDocumentFolder: (id: string) => {
    removedFolders.push(id);
  },
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
  const actual = jest.requireActual('../src/core/database/connection') as {
    ensureDocumentsTable: (db: { execAsync(sql: string): Promise<void> }) => Promise<void>;
  };
  return {
    ...actual,
    getDb: async () => current,
  };
});

import { DOCUMENT_SCHEMA_VERSION, ensureDocumentsTable } from '../src/core/database/connection';
import { deleteCalculation } from '../src/core/database/database';
import {
  deleteDocument,
  getDocument,
  insertDocument,
  listDocumentsByCalculation,
  updateDocumentPhoneSave,
} from '../src/core/documents/documentsRepository';
import type { NewDocumentInput } from '../src/core/documents/types';

function draft(overrides: Partial<NewDocumentInput> = {}): NewDocumentInput {
  return {
    id: 'doc-1',
    calculationId: 'calc-a',
    kind: 'tarjous',
    offerNumber: 10285,
    fileRelPath: 'documents/calc-a/doc-1.pdf',
    fileName: 'Tarjous_10285_Matti_2026-11-03.pdf',
    inputs: {
      offerValidDays: 14,
      ktvPersons: 2,
      ktvPageIncluded: false,
      businessVatMode: 'alv0',
    },
    summary: { total: 1255, pages: 2 },
    appVersion: '1.2.11',
    createdAt: '2026-11-03T14:40:00.000Z',
    ...overrides,
  };
}

describe('documents repository', () => {
  beforeEach(async () => {
    removedFiles.length = 0;
    removedFolders.length = 0;
    const db = new DatabaseSync(':memory:');
    current = adapt(db);
    await ensureDocumentsTable(current);
    await ensureDocumentsTable(current);
  });

  it('sets the schema version once and does not lower a newer version', async () => {
    const version = await current.getFirstAsync('PRAGMA user_version');
    expect(version?.user_version).toBe(DOCUMENT_SCHEMA_VERSION);
    await ensureDocumentsTable(current);
    const again = await current.getFirstAsync('PRAGMA user_version');
    expect(again?.user_version).toBe(DOCUMENT_SCHEMA_VERSION);

    const newer = adapt(new DatabaseSync(':memory:'));
    await newer.execAsync('PRAGMA user_version = 5');
    await ensureDocumentsTable(newer);
    const kept = await newer.getFirstAsync('PRAGMA user_version');
    expect(kept?.user_version).toBe(5);
  });

  it('adds the phone error column to a version 1 table without lowering a newer version', async () => {
    const legacy = adapt(new DatabaseSync(':memory:'));
    await legacy.execAsync(`
      CREATE TABLE documents (
        id TEXT PRIMARY KEY,
        calculation_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        offer_number INTEGER,
        version INTEGER NOT NULL,
        file_rel_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        inputs_json TEXT,
        summary_json TEXT,
        app_version TEXT,
        created_at TEXT NOT NULL,
        phone_save_status TEXT NOT NULL DEFAULT 'skipped',
        phone_uri TEXT
      );
    `);
    await legacy.execAsync('PRAGMA user_version = 1');
    await ensureDocumentsTable(legacy);
    const columns = await legacy.getAllAsync('PRAGMA table_info(documents)');
    expect(columns.map((column) => column.name)).toContain('phone_save_error');
    const version = await legacy.getFirstAsync('PRAGMA user_version');
    expect(version?.user_version).toBe(DOCUMENT_SCHEMA_VERSION);

    await legacy.execAsync('PRAGMA user_version = 5');
    await ensureDocumentsTable(legacy);
    const kept = await legacy.getFirstAsync('PRAGMA user_version');
    expect(kept?.user_version).toBe(5);
  });

  it('stores a failed phone copy and a later success', async () => {
    await insertDocument(draft());
    await updateDocumentPhoneSave('doc-1', {
      status: 'failed',
      phoneUri: null,
      error: 'disk full',
    });
    expect(await getDocument('doc-1')).toMatchObject({
      phoneSaveStatus: 'failed',
      phoneUri: null,
      phoneSaveError: 'disk full',
      fileRelPath: 'documents/calc-a/doc-1.pdf',
    });
    await updateDocumentPhoneSave('doc-1', {
      status: 'ok',
      phoneUri: 'content://tree/primary:Urakkalaskuri/Tarjous.pdf',
      error: null,
    });
    expect(await getDocument('doc-1')).toMatchObject({
      phoneSaveStatus: 'ok',
      phoneUri: 'content://tree/primary:Urakkalaskuri/Tarjous.pdf',
      phoneSaveError: null,
      fileRelPath: 'documents/calc-a/doc-1.pdf',
    });
  });

  it('creates the table twice without dropping rows', async () => {
    await insertDocument(draft());
    await ensureDocumentsTable(current);
    expect(await getDocument('doc-1')).toMatchObject({ id: 'doc-1', version: 1 });
  });

  it('numbers versions per kind, keeps a card offer number empty, and lists newest first', async () => {
    await insertDocument(draft({ id: 'old', createdAt: '2026-11-01T08:00:00.000Z', fileRelPath: 'documents/calc-a/old.pdf' }));
    await insertDocument(draft({ id: 'new', createdAt: '2026-11-03T14:40:00.000Z', fileRelPath: 'documents/calc-a/new.pdf' }));
    const card = await insertDocument(
      draft({
        id: 'card',
        kind: 'urakkakortti',
        offerNumber: null,
        createdAt: '2026-11-02T12:00:00.000Z',
        fileRelPath: 'documents/calc-a/card.pdf',
        inputs: {
          urakkakorttiMode: 'alihankkija',
          urakkakorttiHidePrices: false,
          urakkakorttiHuomioitavaa: 'Telineet',
          urakkakorttiRivihinnat: { a: 640 },
        },
        summary: { total: 640, pages: 1 },
      }),
    );
    expect(card.version).toBe(1);
    expect(card.offerNumber).toBeNull();
    expect(card.phoneSaveStatus).toBe('skipped');
    expect(card.phoneUri).toBeNull();
    expect(card.phoneSaveError).toBeNull();
    const offer = await getDocument('new');
    expect(offer?.version).toBe(2);
    expect(offer?.inputs).toEqual({
      offerValidDays: 14,
      ktvPersons: 2,
      ktvPageIncluded: false,
      businessVatMode: 'alv0',
    });
    expect(offer?.summary).toEqual({ total: 1255, pages: 2 });
    const listed = await listDocumentsByCalculation('calc-a');
    expect(listed.map((row) => row.id)).toEqual(['new', 'card', 'old']);
    expect(await getDocument('missing')).toBeNull();
  });

  it('deletes one document file and cascades the calculation folder', async () => {
    await insertDocument(draft());
    await insertDocument(
      draft({
        id: 'other',
        calculationId: 'calc-b',
        fileRelPath: 'documents/calc-b/other.pdf',
        createdAt: '2026-11-04T10:00:00.000Z',
      }),
    );
    await deleteDocument('doc-1');
    expect(removedFiles).toEqual(['documents/calc-a/doc-1.pdf']);
    expect(await listDocumentsByCalculation('calc-a')).toEqual([]);
    expect((await listDocumentsByCalculation('calc-b')).map((row) => row.id)).toEqual(['other']);

    await current.execAsync(`
      CREATE TABLE calculations (id TEXT PRIMARY KEY);
      CREATE TABLE calculation_lines (id TEXT PRIMARY KEY, calculation_id TEXT);
    `);
    await deleteCalculation('calc-b');
    expect(await listDocumentsByCalculation('calc-b')).toEqual([]);
    expect(removedFolders).toEqual(['calc-b']);
  });
});
