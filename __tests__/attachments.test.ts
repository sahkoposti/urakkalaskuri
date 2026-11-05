jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const ids = { n: 0 };
jest.mock('expo-crypto', () => ({
  randomUUID: () => {
    ids.n += 1;
    return `att-${ids.n}`;
  },
}));

const removedFiles: string[] = [];
const removedFolders: string[] = [];
const copiedFiles: string[] = [];
const copyFailures = new Set<string>();
const diskPaths: string[] = [];

jest.mock('../src/core/attachments/attachmentFiles', () => ({
  copyAttachmentFile: (source: string, target: string) => {
    if (copyFailures.has(source)) throw new Error('levy täynnä');
    copiedFiles.push(`${source} => ${target}`);
  },
  removeStoredAttachment: (path: string) => {
    removedFiles.push(path);
  },
  deleteCalculationAttachmentFolder: (id: string) => {
    removedFolders.push(id);
  },
  listAttachmentDiskPaths: () => diskPaths.slice(),
  placeAttachmentFile: () => 'attachments/unused/x.bin',
}));

jest.mock('../src/core/documents/documentFiles', () => ({
  listDocumentDiskPaths: () => [],
  removeStoredPdf: () => undefined,
  deleteCalculationDocumentFolder: () => undefined,
}));
jest.mock('../src/core/documents/documentActions', () => ({
  deleteExpiredShareCopies: () => undefined,
}));
jest.mock('../src/core/documents/documentsRepository', () => ({
  listDocumentFilePaths: async () => [],
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

import { ATTACHMENT_SCHEMA_VERSION, ensureAttachmentsTable, ensureDocumentsTable } from '../src/core/database/connection';
import { copyCalculationRecord, deleteCalculation } from '../src/core/database/database';
import { cleanupDocumentsOnStartup } from '../src/core/documents/documentStartup';
import {
  attachmentRelativePath,
  attachmentRelativePathFromUris,
  extensionForMime,
} from '../src/core/attachments/attachmentPaths';
import {
  addAttachment,
  attachmentTotals,
  copyAttachmentsForCalculation,
  getAttachment,
  listAttachments,
  moveAttachment,
  removeAllAttachments,
  removeAttachment,
  updateAttachment,
} from '../src/core/attachments/attachmentsRepository';
import type { NewAttachmentInput } from '../src/core/attachments/types';
import { record } from './pdfFixtures';

function draft(overrides: Partial<NewAttachmentInput> = {}): NewAttachmentInput {
  return {
    id: 'a1',
    calculationId: 'calc-a',
    kind: 'image',
    fileRelPath: 'attachments/calc-a/a1.jpg',
    mime: 'image/jpeg',
    sizeBytes: 10,
    width: 800,
    height: 600,
    createdAt: '2026-11-05T08:00:00.000Z',
    ...overrides,
  };
}

describe('attachments', () => {
  beforeEach(async () => {
    ids.n = 0;
    removedFiles.length = 0;
    removedFolders.length = 0;
    copiedFiles.length = 0;
    copyFailures.clear();
    diskPaths.length = 0;
    current = adapt(new DatabaseSync(':memory:'));
    await ensureAttachmentsTable(current);
  });

  it('creates the table idempotently and sets user_version 3 without lowering a newer one', async () => {
    const version = await current.getFirstAsync('PRAGMA user_version');
    expect(version?.user_version).toBe(ATTACHMENT_SCHEMA_VERSION);
    expect(ATTACHMENT_SCHEMA_VERSION).toBe(3);
    await addAttachment(draft());
    await ensureAttachmentsTable(current);
    expect(await getAttachment('a1')).toMatchObject({ id: 'a1', caption: '' });
    const again = await current.getFirstAsync('PRAGMA user_version');
    expect(again?.user_version).toBe(3);
    const index = await current.getAllAsync('PRAGMA index_info(attachments_calculation_sort_idx)');
    expect(index.map((column) => column.name)).toEqual(['calculation_id', 'sort_order']);

    const newer = adapt(new DatabaseSync(':memory:'));
    await newer.execAsync('PRAGMA user_version = 5');
    await ensureAttachmentsTable(newer);
    expect((await newer.getFirstAsync('PRAGMA user_version'))?.user_version).toBe(5);

    const legacy = adapt(new DatabaseSync(':memory:'));
    await ensureDocumentsTable(legacy);
    await legacy.execAsync(
      `INSERT INTO documents (
        id, calculation_id, kind, version, file_rel_path, file_name, created_at, phone_save_status
      ) VALUES ('doc', 'calc-a', 'tarjous', 1, 'documents/calc-a/doc.pdf', 'a.pdf', '2026-11-01T00:00:00.000Z', 'skipped')`,
    );
    expect((await legacy.getFirstAsync('PRAGMA user_version'))?.user_version).toBe(2);
    await ensureAttachmentsTable(legacy);
    expect((await legacy.getFirstAsync('PRAGMA user_version'))?.user_version).toBe(3);
    expect(await legacy.getFirstAsync('SELECT id FROM documents WHERE id = ?', 'doc')).toMatchObject({ id: 'doc' });
    const columns = await legacy.getAllAsync('PRAGMA table_info(attachments)');
    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'calculation_id',
      'kind',
      'destination',
      'caption',
      'file_rel_path',
      'mime',
      'size_bytes',
      'width',
      'height',
      'sort_order',
      'created_at',
    ]);
  });

  it('stores a new attachment on the card, caps the caption, and orders by sort_order', async () => {
    const first = await addAttachment(draft({ caption: '  Julkisivu  ' }));
    expect(first).toMatchObject({ destination: 'card', caption: 'Julkisivu', sortOrder: 0, width: 800 });
    await addAttachment(draft({
      id: 'a2',
      kind: 'pdf',
      destination: 'both',
      fileRelPath: 'attachments/calc-a/a2.pdf',
      mime: 'application/pdf',
      sizeBytes: 25,
      width: null,
      height: null,
      caption: 'ä'.repeat(120),
    }));
    await addAttachment(draft({
      id: 'a3',
      calculationId: 'calc-b',
      destination: 'card',
      fileRelPath: 'attachments/calc-b/a3.jpg',
    }));
    await expect(addAttachment(draft({ id: 'too-long', caption: 'ä'.repeat(121) }))).rejects.toThrow(/120/);
    expect(await getAttachment('too-long')).toBeNull();

    expect((await listAttachments('calc-a')).map((row) => row.id)).toEqual(['a1', 'a2']);
    expect((await listAttachments('calc-a'))[1]).toMatchObject({ destination: 'both', width: null, height: null });
    expect(await attachmentTotals('calc-a')).toEqual({ count: 2, sizeBytes: 35 });

    await moveAttachment('a2', 'up');
    expect((await listAttachments('calc-a')).map((row) => row.id)).toEqual(['a2', 'a1']);
    await moveAttachment('a2', 'up');
    expect((await listAttachments('calc-a')).map((row) => row.id)).toEqual(['a2', 'a1']);
    await moveAttachment('a1', 'down');
    expect((await listAttachments('calc-a')).map((row) => row.id)).toEqual(['a2', 'a1']);

    await updateAttachment('a1', { caption: 'Sokkeli', destination: 'offer' });
    expect(await getAttachment('a1')).toMatchObject({ caption: 'Sokkeli', destination: 'offer', sortOrder: 1 });
  });

  it('keeps an explicit none destination', async () => {
    const kept = await addAttachment(draft({ id: 'none-1', destination: 'none', fileRelPath: 'attachments/calc-a/none.jpg' }));
    expect(kept.destination).toBe('none');
  });

  it('builds the relative path and reads a folder uri with or without a trailing slash', () => {
    expect(extensionForMime('image/jpeg')).toBe('jpg');
    expect(extensionForMime('application/pdf')).toBe('pdf');
    expect(attachmentRelativePath('calc-a', 'a1', 'jpg')).toBe('attachments/calc-a/a1.jpg');
    const root = 'file:///data/user/0/app/files/attachments';
    const file = `${root}/calc-a/a1.jpg`;
    expect(attachmentRelativePathFromUris(`${root}/calc-a/`, file)).toBe('attachments/calc-a/a1.jpg');
    expect(attachmentRelativePathFromUris(`${root}/calc-a`, `${file}/`)).toBe('attachments/calc-a/a1.jpg');
  });

  it('removes one file and cascades the calculation folder', async () => {
    await addAttachment(draft());
    await addAttachment(draft({ id: 'b1', calculationId: 'calc-b', fileRelPath: 'attachments/calc-b/b1.jpg' }));
    await removeAttachment('a1');
    expect(removedFiles).toEqual(['attachments/calc-a/a1.jpg']);
    expect(await listAttachments('calc-a')).toEqual([]);

    await current.execAsync(`
      CREATE TABLE calculations (id TEXT PRIMARY KEY);
      CREATE TABLE calculation_lines (id TEXT PRIMARY KEY, calculation_id TEXT);
      CREATE TABLE documents (id TEXT PRIMARY KEY, calculation_id TEXT);
      INSERT INTO calculations (id) VALUES ('calc-b');
    `);
    await deleteCalculation('calc-b');
    expect(await listAttachments('calc-b')).toEqual([]);
    expect(removedFolders).toEqual(['calc-b']);
  });

  it('removes every attachment of one calculation', async () => {
    await addAttachment(draft());
    await addAttachment(draft({ id: 'a2', fileRelPath: 'attachments/calc-a/a2.jpg', sizeBytes: 4 }));
    await addAttachment(draft({ id: 'b1', calculationId: 'calc-b', fileRelPath: 'attachments/calc-b/b1.jpg' }));
    await removeAllAttachments('calc-a');
    expect(await listAttachments('calc-a')).toEqual([]);
    expect((await listAttachments('calc-b')).map((row) => row.id)).toEqual(['b1']);
    expect(removedFolders).toEqual(['calc-a']);
  });

  it('copies attachments to new files and reports a file failure without failing the calculation', async () => {
    await addAttachment(draft({ caption: 'Julkisivu', destination: 'offer' }));
    await addAttachment(draft({
      id: 'broken',
      caption: 'Rikkoutuva',
      destination: 'card',
      fileRelPath: 'attachments/calc-a/broken.jpg',
      sizeBytes: 4,
      createdAt: '2026-11-05T09:00:00.000Z',
    }));
    copyFailures.add('attachments/calc-a/broken.jpg');
    let nextId = 0;
    const failures = await copyAttachmentsForCalculation('calc-a', 'calc-copy', () => {
      nextId += 1;
      return `copy-${nextId}`;
    });
    expect(failures).toEqual([{ sourceId: 'broken', message: 'levy täynnä' }]);
    const copied = await listAttachments('calc-copy');
    expect(copied).toHaveLength(1);
    expect(copied[0]).toMatchObject({
      calculationId: 'calc-copy',
      caption: 'Julkisivu',
      destination: 'offer',
      sortOrder: 0,
      mime: 'image/jpeg',
      sizeBytes: 10,
    });
    expect(copied[0]?.id).not.toBe('a1');
    expect(copied[0]?.fileRelPath).toBe(`attachments/calc-copy/${copied[0]?.id}.jpg`);
    expect(copiedFiles).toEqual([`attachments/calc-a/a1.jpg => ${copied[0]?.fileRelPath}`]);
    expect((await listAttachments('calc-a')).map((row) => row.id)).toEqual(['a1', 'broken']);

    copyFailures.clear();
    const source = record({}, { id: 'calc-a', offerNumber: 10285 });
    const result = await copyCalculationRecord(source, 'calc-via-record');
    expect(result.record.id).toBe('calc-via-record');
    expect(result.record.offerNumber).toBeUndefined();
    expect(result.attachmentCopyFailures).toEqual([]);
    expect((await listAttachments('calc-via-record')).map((row) => row.caption)).toEqual(['Julkisivu', 'Rikkoutuva']);
  });

  it('drops a copied file when the new row cannot be stored and still returns the other rows', async () => {
    await addAttachment(draft());
    await addAttachment(draft({ id: 'a2', fileRelPath: 'attachments/calc-a/a2.jpg', caption: 'Toinen', sizeBytes: 3 }));
    const failures = await copyAttachmentsForCalculation('calc-a', 'calc-copy', () => 'same-id');
    expect(failures).toHaveLength(1);
    expect(failures[0]?.sourceId).toBe('a2');
    expect(await listAttachments('calc-copy')).toHaveLength(1);
    expect(removedFiles).toEqual(['attachments/calc-copy/same-id.jpg']);
  });

  it('deletes an orphan attachment file and keeps a row whose file is missing', async () => {
    await addAttachment(draft({ id: 'kept', fileRelPath: 'attachments/calc-a/kept.jpg' }));
    await addAttachment(draft({ id: 'missing', fileRelPath: 'attachments/calc-a/missing.jpg' }));
    removedFiles.length = 0;
    diskPaths.push('attachments/calc-a/kept.jpg', 'attachments/calc-a/orphan.jpg');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await cleanupDocumentsOnStartup();
    expect(removedFiles).toEqual(['attachments/calc-a/orphan.jpg']);
    expect(warn).toHaveBeenCalledWith('Liitteen tiedosto puuttuu, riviä ei poistettu: attachments/calc-a/missing.jpg');
    expect(await getAttachment('missing')).toMatchObject({ id: 'missing' });
    expect(await getAttachment('kept')).toMatchObject({ id: 'kept' });
    warn.mockRestore();
  });
});
