jest.mock('expo-file-system', () => ({
  Directory: class {},
  File: class {},
  Paths: { document: 'doc' },
}));
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('expo-print', () => ({ printAsync: jest.fn(), printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.3.3' } }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'id' }));

import { DatabaseSync } from 'node:sqlite';

import { UNSAFE_CALCULATION_FOLDER_ID_WARNING } from '../src/core/documents/calculationFolderId';
import {
  cleanupOrphanCalculationFolders,
  EMPTY_CALCULATION_TABLE_WARNING,
  startupOrphanFolderPlan,
} from '../src/core/documents/documentStartup';

const documentPaths = ['documents/kept/tarjous.pdf', 'documents/gone/kortti.pdf'];
const attachmentPaths = ['attachments/kept/kuva.jpg', 'attachments/gone/liite.pdf'];

function calculationDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE calculations (id TEXT PRIMARY KEY NOT NULL)');
  return db;
}

function readIds(db: DatabaseSync) {
  return async () => db.prepare('SELECT id FROM calculations').all().map((row) => String(row.id));
}

describe('cleanupOrphanCalculationFolders', () => {
  it('does not delete folders when the calculations table has no rows', async () => {
    const db = calculationDb();
    const deletedDocuments: string[] = [];
    const deletedAttachments: string[] = [];
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await cleanupOrphanCalculationFolders(documentPaths, attachmentPaths, {
      readCalculationIds: readIds(db),
      deleteDocumentFolder: (id) => deletedDocuments.push(id),
      deleteAttachmentFolder: (id) => deletedAttachments.push(id),
    });
    expect(db.prepare('SELECT COUNT(*) AS n FROM calculations').get()).toEqual({ n: 0 });
    expect(startupOrphanFolderPlan(new Set(), documentPaths, attachmentPaths)).toBeNull();
    expect(deletedDocuments).toEqual([]);
    expect(deletedAttachments).toEqual([]);
    expect(warn).toHaveBeenCalledWith(EMPTY_CALCULATION_TABLE_WARNING);
    warn.mockRestore();
    db.close();
  });

  it('deletes nothing and does not throw when the calculation id read fails', async () => {
    const deletedDocuments: string[] = [];
    const deletedAttachments: string[] = [];
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(
      cleanupOrphanCalculationFolders(documentPaths, attachmentPaths, {
        readCalculationIds: async () => {
          throw new Error('tietokanta kiinni');
        },
        deleteDocumentFolder: (id) => deletedDocuments.push(id),
        deleteAttachmentFolder: (id) => deletedAttachments.push(id),
      }),
    ).resolves.toBeUndefined();
    expect(deletedDocuments).toEqual([]);
    expect(deletedAttachments).toEqual([]);
    expect(warn).toHaveBeenCalledWith('Laskelmien tunnuksia ei voitu lukea, kansioita ei siivota', expect.any(Error));
    warn.mockRestore();
  });

  it('deletes only folders whose calculation id is gone', async () => {
    const db = calculationDb();
    db.prepare('INSERT INTO calculations (id) VALUES (?)').run('kept');
    const deletedDocuments: string[] = [];
    const deletedAttachments: string[] = [];
    await cleanupOrphanCalculationFolders(documentPaths, attachmentPaths, {
      readCalculationIds: readIds(db),
      deleteDocumentFolder: (id) => deletedDocuments.push(id),
      deleteAttachmentFolder: (id) => deletedAttachments.push(id),
    });
    expect(deletedDocuments).toEqual(['gone']);
    expect(deletedAttachments).toEqual(['gone']);
    expect(startupOrphanFolderPlan(new Set(['kept']), documentPaths, attachmentPaths)).toEqual({
      documentIds: ['gone'],
      attachmentIds: ['gone'],
    });
    db.close();
  });

  it('skips an invalid folder name found on disk and still deletes a valid orphan', async () => {
    const db = calculationDb();
    db.prepare('INSERT INTO calculations (id) VALUES (?)').run('kept');
    const validOrphan = '11111111-2222-4333-8444-555555555555';
    const deletedDocuments: string[] = [];
    const deletedAttachments: string[] = [];
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await cleanupOrphanCalculationFolders(
      [
        'documents/kept/tarjous.pdf',
        `documents/${validOrphan}/kortti.pdf`,
        'documents/../sneaky.pdf',
        'documents/a\\b/kortti.pdf',
      ],
      ['attachments/ a/kuva.jpg', 'attachments/a\u0000/liite.pdf'],
      {
        readCalculationIds: readIds(db),
        deleteDocumentFolder: (id) => deletedDocuments.push(id),
        deleteAttachmentFolder: (id) => deletedAttachments.push(id),
      },
    );
    expect(deletedDocuments).toEqual([validOrphan]);
    expect(deletedAttachments).toEqual([]);
    expect(warn).toHaveBeenCalledWith(UNSAFE_CALCULATION_FOLDER_ID_WARNING, '..');
    expect(warn).toHaveBeenCalledWith(UNSAFE_CALCULATION_FOLDER_ID_WARNING, 'a\\b');
    expect(warn).toHaveBeenCalledWith(UNSAFE_CALCULATION_FOLDER_ID_WARNING, ' a');
    expect(warn).toHaveBeenCalledWith(UNSAFE_CALCULATION_FOLDER_ID_WARNING, 'a\u0000');
    warn.mockRestore();
    db.close();
  });
});
