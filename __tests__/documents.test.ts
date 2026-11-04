import { commitStoredDocument } from '../src/core/documents/commitStoredDocument';
import {
  DOCUMENT_EMPTY_LIST,
  DOCUMENT_SAVED_IN_APP,
  documentListLabel,
  documentPageCountLabel,
  documentReadyTitle,
  formatDocumentCreatedAt,
} from '../src/core/documents/documentLabels';
import {
  tarjousDocumentInputs,
  urakkakorttiDocumentInputs,
  urakkakorttiDocumentTotal,
} from '../src/core/documents/documentInputs';
import { formatCurrency } from '../src/core/utils/formatters';
import { record } from './pdfFixtures';

describe('document labels', () => {
  it('formats a Finnish local timestamp and the list rows', () => {
    const createdAt = new Date(2026, 10, 3, 16, 40);
    expect(formatDocumentCreatedAt(createdAt)).toBe('3.11.2026 16.40');
    expect(
      documentListLabel({
        kind: 'tarjous',
        offerNumber: 10285,
        version: 2,
        createdAt,
        total: 6036.55,
      }),
    ).toBe(`Tarjous 10285 · v2 · 3.11.2026 16.40 · ${formatCurrency(6036.55)}`);
    expect(
      documentListLabel({
        kind: 'urakkakortti',
        offerNumber: null,
        version: 1,
        createdAt,
        total: null,
      }),
    ).toBe('Urakkakortti · v1 · 3.11.2026 16.40');
    expect(documentListLabel({
      kind: 'tarjous',
      offerNumber: 10285,
      version: 2,
      createdAt,
      total: 6036.55,
    })).not.toContain('Ei puhelimessa');
  });

  it('names the result sheet and the page count', () => {
    expect(documentReadyTitle('tarjous')).toBe('Tarjous valmis');
    expect(documentReadyTitle('urakkakortti')).toBe('Urakkakortti valmis');
    expect(documentPageCountLabel(1)).toBe('1 sivu');
    expect(documentPageCountLabel(6)).toBe('6 sivua');
    expect(DOCUMENT_SAVED_IN_APP).toBe('Tallennettu sovellukseen: Dokumentit');
    expect(DOCUMENT_EMPTY_LIST).toBe('Ei tallennettuja dokumentteja.');
  });
});

describe('commitStoredDocument', () => {
  it('inserts after the file exists and deletes the file when the insert fails', async () => {
    const events: string[] = [];
    await expect(
      commitStoredDocument(
        'documents/calc/doc.pdf',
        async () => {
          events.push('insert');
          throw new Error('Dokumentin tallennus epäonnistui.');
        },
        (path) => {
          events.push(`delete:${path}`);
        },
      ),
    ).rejects.toThrow('Dokumentin tallennus epäonnistui.');
    expect(events).toEqual(['insert', 'delete:documents/calc/doc.pdf']);
  });

  it('returns the inserted row when the insert succeeds', async () => {
    const removed: string[] = [];
    const saved = await commitStoredDocument('documents/calc/doc.pdf', async () => ({ id: 'doc' }), (path) => {
      removed.push(path);
    });
    expect(saved).toEqual({ id: 'doc' });
    expect(removed).toEqual([]);
  });
});

describe('document inputs', () => {
  it('stores the offer inputs that were used and omits a card total when prices are hidden', () => {
    const offer = record({}, { formSnapshot: { formId: 'f', formVersion: 1, fields: [] } });
    expect(tarjousDocumentInputs(offer, 31)).toMatchObject({
      offerValidDays: 31,
      ktvPersons: 1,
      ktvPageIncluded: true,
      businessVatMode: 'alv0',
    });
    const hidden = record({}, {
      formSnapshot: { formId: 'f', formVersion: 1, fields: [], urakkakorttiHidePrices: true },
    });
    expect(urakkakorttiDocumentInputs(hidden)).toMatchObject({
      urakkakorttiHidePrices: true,
      urakkakorttiMode: 'alihankkija',
    });
    expect(urakkakorttiDocumentTotal(hidden, 1.5)).toBeNull();
  });
});
