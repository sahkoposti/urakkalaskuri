import {
  SHARE_COPY_MAX_AGE_MS,
  shareCopyUrisToDelete,
  shareDocumentFileName,
  shareStoredPdf,
} from '../src/core/documents/documentShare';
import {
  applyDocumentStorageCleanup,
  applyOrphanCalculationFolderCleanup,
  documentRelativePathFromUris,
  fileSystemEntryName,
  planDocumentStorageCleanup,
  planOrphanCalculationFolders,
} from '../src/core/documents/documentStorage';

describe('shareDocumentFileName', () => {
  const createdAt = new Date(2026, 10, 3, 14, 5);

  it('builds an ASCII name without the customer', () => {
    expect(
      shareDocumentFileName({ kind: 'tarjous', offerNumber: 10285, version: 2, createdAt }),
    ).toBe('Tarjous_10285_v2_2026-11-03_1405.pdf');
    expect(
      shareDocumentFileName({ kind: 'urakkakortti', offerNumber: null, version: 1, createdAt }),
    ).toBe('Urakkakortti_v1_2026-11-03_1405.pdf');
    expect(
      shareDocumentFileName({ kind: 'tarjous', offerNumber: null, version: 4, createdAt }),
    ).toBe('Tarjous_v4_2026-11-03_1405.pdf');
    const later = shareDocumentFileName({
      kind: 'tarjous',
      offerNumber: 10285,
      version: 2,
      createdAt: new Date(2026, 10, 3, 9, 7),
    });
    expect(later).toBe('Tarjous_10285_v2_2026-11-03_0907.pdf');
    expect(later).not.toBe(
      shareDocumentFileName({ kind: 'tarjous', offerNumber: 10285, version: 2, createdAt }),
    );
    expect(later).toMatch(/^[\x20-\x7e]+$/);
    expect(later).not.toContain('Matti');
  });
});

describe('shareStoredPdf', () => {
  it('keeps the cache copy after a successful share', async () => {
    const events: string[] = [];
    await shareStoredPdf({
      storedUri: 'file:///docs/documents/calc/11111111-2222-3333-4444-555555555555.pdf',
      shareName: 'Tarjous_10285_v2_2026-11-03_1405.pdf',
      copyToCache: async (storedUri, shareName) => {
        events.push(`copy:${storedUri} -> ${shareName}`);
        return `file:///cache/document-share/${shareName}`;
      },
      share: async (uri, dialogTitle) => {
        events.push(`share:${uri}:${dialogTitle}`);
      },
      removeTemp: (uri) => {
        events.push(`remove:${uri}`);
      },
    });
    expect(events).toEqual([
      'copy:file:///docs/documents/calc/11111111-2222-3333-4444-555555555555.pdf -> Tarjous_10285_v2_2026-11-03_1405.pdf',
      'share:file:///cache/document-share/Tarjous_10285_v2_2026-11-03_1405.pdf:Tarjous_10285_v2_2026-11-03_1405.pdf',
    ]);
  });

  it('removes the temp copy when sharing fails and leaves the stored file', async () => {
    const removed: string[] = [];
    await expect(
      shareStoredPdf({
        storedUri: 'file:///docs/documents/calc/uuid.pdf',
        shareName: 'Urakkakortti_v1_2026-11-03_1405.pdf',
        copyToCache: async (_stored, shareName) => `file:///cache/${shareName}`,
        share: async () => {
          throw new Error('Jakaminen ei ole käytettävissä tällä laitteella.');
        },
        removeTemp: (uri) => {
          removed.push(uri);
        },
      }),
    ).rejects.toThrow('Jakaminen ei ole käytettävissä');
    expect(removed).toEqual(['file:///cache/Urakkakortti_v1_2026-11-03_1405.pdf']);
    expect(removed.join(' ')).not.toContain('uuid.pdf');
  });
});

describe('share copy age', () => {
  const now = 1_700_000_000_000;

  it('deletes only copies older than the named threshold', () => {
    expect(SHARE_COPY_MAX_AGE_MS).toBe(30 * 60 * 1000);
    const oldUri = 'file:///cache/document-share/old.pdf';
    const exactUri = 'file:///cache/document-share/exact.pdf';
    const freshUri = 'file:///cache/document-share/fresh.pdf';
    const unknownUri = 'file:///cache/document-share/unknown.pdf';
    const deleted = shareCopyUrisToDelete(
      [
        { uri: oldUri, modifiedAtMs: now - SHARE_COPY_MAX_AGE_MS - 1 },
        { uri: exactUri, modifiedAtMs: now - SHARE_COPY_MAX_AGE_MS },
        { uri: freshUri, modifiedAtMs: now - SHARE_COPY_MAX_AGE_MS + 1 },
        { uri: unknownUri, modifiedAtMs: null },
      ],
      now,
    );
    expect(deleted).toEqual([oldUri]);
  });
});

describe('document disk paths', () => {
  const root = 'file:///data/user/0/app/files/documents';

  it('reads a calculation folder whether or not the directory uri has a trailing slash', () => {
    const file = `${root}/calc-1/11111111-2222-3333-4444-555555555555.pdf`;
    expect(fileSystemEntryName(`${root}/calc-1/`)).toBe('calc-1');
    expect(fileSystemEntryName(`${root}/calc-1`)).toBe('calc-1');
    expect(documentRelativePathFromUris(`${root}/calc-1/`, file)).toBe(
      'documents/calc-1/11111111-2222-3333-4444-555555555555.pdf',
    );
    expect(documentRelativePathFromUris(`${root}/calc-1`, `${file}/`)).toBe(
      'documents/calc-1/11111111-2222-3333-4444-555555555555.pdf',
    );
    expect(documentRelativePathFromUris(`${root}/nested/calc-2/`, `${root}/nested/calc-2/card.PDF`)).toBe(
      'documents/calc-2/card.PDF',
    );
    expect(documentRelativePathFromUris(`${root}/calc-1/`, `${root}/calc-1/notes.txt`)).toBeNull();
  });
});

describe('document storage cleanup', () => {
  it('deletes orphan files and only reports a row whose file is missing', () => {
    const plan = planDocumentStorageCleanup({
      storedPaths: ['documents/calc/kept.pdf', 'documents/calc/missing.pdf'],
      diskPaths: ['documents/calc/kept.pdf', 'documents/calc/orphan.pdf'],
    });
    expect(plan.removeFiles).toEqual(['documents/calc/orphan.pdf']);
    expect(plan.missingRows).toEqual(['documents/calc/missing.pdf']);
    const deleted: string[] = [];
    const reported: string[] = [];
    applyDocumentStorageCleanup(plan, {
      deleteFile: (path) => deleted.push(path),
      reportMissing: (path) => reported.push(path),
    });
    expect(deleted).toEqual(['documents/calc/orphan.pdf']);
    expect(reported).toEqual(['documents/calc/missing.pdf']);
  });

  it('plans folder cleanup for calculation ids that are no longer stored', () => {
    const plan = planOrphanCalculationFolders({
      documentPaths: ['documents/gone/a.pdf', 'documents/kept/b.pdf', 'documents/gone/c.pdf'],
      attachmentPaths: ['attachments/gone/x.jpg', 'attachments/also-gone/y.jpg', 'attachments/kept/z.jpg'],
      existingIds: new Set(['kept']),
    });
    expect(plan.documentIds).toEqual(['gone']);
    expect(plan.attachmentIds).toEqual(['gone', 'also-gone']);
  });

  it('continues folder cleanup when one folder delete fails', () => {
    const deletedDocuments: string[] = [];
    const deletedAttachments: string[] = [];
    const reported: string[] = [];
    applyOrphanCalculationFolderCleanup(
      { documentIds: ['gone'], attachmentIds: ['gone'] },
      {
        deleteDocumentFolder: () => {
          throw new Error('kansio lukittu');
        },
        deleteAttachmentFolder: (id) => deletedAttachments.push(id),
        report: (kind, id) => reported.push(`${kind}:${id}`),
      },
    );
    expect(deletedDocuments).toEqual([]);
    expect(deletedAttachments).toEqual(['gone']);
    expect(reported).toEqual(['documents:gone']);
  });
});
