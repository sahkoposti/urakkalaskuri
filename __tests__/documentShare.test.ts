import { shareDocumentFileName, shareStoredPdf } from '../src/core/documents/documentShare';
import { applyDocumentStorageCleanup, planDocumentStorageCleanup } from '../src/core/documents/documentStorage';

describe('shareDocumentFileName', () => {
  const createdAt = new Date(2026, 10, 3);

  it('builds an ASCII name without the customer', () => {
    expect(
      shareDocumentFileName({ kind: 'tarjous', offerNumber: 10285, version: 2, createdAt }),
    ).toBe('Tarjous_10285_v2_2026-11-03.pdf');
    expect(
      shareDocumentFileName({ kind: 'urakkakortti', offerNumber: null, version: 1, createdAt }),
    ).toBe('Urakkakortti_v1_2026-11-03.pdf');
    expect(
      shareDocumentFileName({ kind: 'tarjous', offerNumber: null, version: 4, createdAt }),
    ).toBe('Tarjous_v4_2026-11-03.pdf');
    const name = shareDocumentFileName({
      kind: 'tarjous',
      offerNumber: 10285,
      version: 2,
      createdAt,
    });
    expect(name).toMatch(/^[\x20-\x7e]+$/);
    expect(name).not.toContain('Matti');
  });
});

describe('shareStoredPdf', () => {
  it('shares a cache copy under the readable name and deletes only that copy', async () => {
    const events: string[] = [];
    await shareStoredPdf({
      storedUri: 'file:///docs/documents/calc/11111111-2222-3333-4444-555555555555.pdf',
      shareName: 'Tarjous_10285_v2_2026-11-03.pdf',
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
      'copy:file:///docs/documents/calc/11111111-2222-3333-4444-555555555555.pdf -> Tarjous_10285_v2_2026-11-03.pdf',
      'share:file:///cache/document-share/Tarjous_10285_v2_2026-11-03.pdf:Tarjous_10285_v2_2026-11-03.pdf',
      'remove:file:///cache/document-share/Tarjous_10285_v2_2026-11-03.pdf',
    ]);
  });

  it('removes the temp copy when sharing fails and leaves the stored file', async () => {
    const removed: string[] = [];
    await expect(
      shareStoredPdf({
        storedUri: 'file:///docs/documents/calc/uuid.pdf',
        shareName: 'Urakkakortti_v1_2026-11-03.pdf',
        copyToCache: async (_stored, shareName) => `file:///cache/${shareName}`,
        share: async () => {
          throw new Error('Jakaminen ei ole käytettävissä tällä laitteella.');
        },
        removeTemp: (uri) => {
          removed.push(uri);
        },
      }),
    ).rejects.toThrow('Jakaminen ei ole käytettävissä');
    expect(removed).toEqual(['file:///cache/Urakkakortti_v1_2026-11-03.pdf']);
    expect(removed.join(' ')).not.toContain('uuid.pdf');
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
});
