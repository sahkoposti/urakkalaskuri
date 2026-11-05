const mockPrint = jest.fn();
const mockMove = jest.fn();
const mockDelete = jest.fn();
const mockCreate = jest.fn();
const existing = new Set<string>();

jest.mock('expo-print', () => ({ printToFileAsync: (...args: unknown[]) => mockPrint(...args) }));
jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }
    get exists() {
      return existing.has(this.uri);
    }
    create() {
      mockCreate(this.uri);
      existing.add(this.uri);
    }
    delete() {
      mockDelete(this.uri);
      existing.delete(this.uri);
    }
  }
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }
    get exists() {
      return existing.has(this.uri);
    }
    delete() {
      mockDelete(this.uri);
      existing.delete(this.uri);
    }
    move(dest: { uri: string }) {
      mockMove(this.uri, dest.uri);
      existing.delete(this.uri);
      existing.add(dest.uri);
    }
  }
  return { File, Directory, Paths: { document: { uri: 'file:///docs' }, cache: { uri: 'file:///cache' } } };
});

import { PDFDocument } from '@cantoo/pdf-lib';

import { ATTACHMENT_PDF_MERGE_FAILED_MESSAGE } from '../src/core/attachments/attachmentMessages';
import type { AttachmentPdfDeps } from '../src/core/attachments/prepareAttachmentPrint';
import type { Attachment } from '../src/core/attachments/types';
import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { generatePdf } from '../src/core/pdf/generatePdf';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { input, record } from './pdfFixtures';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function attachment(partial: Partial<Attachment> & Pick<Attachment, 'id'>): Attachment {
  return {
    calculationId: 'c1',
    kind: 'image',
    destination: 'offer',
    caption: '',
    fileRelPath: `attachments/c1/${partial.id}.jpg`,
    mime: 'image/jpeg',
    sizeBytes: 40,
    width: 8,
    height: 8,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

async function pdf(pages: [number, number][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const [width, height] of pages) doc.addPage([width, height]);
  return doc.save();
}

function offerHtml(sectionHtml: string): string {
  const ctx = buildPdfContext(input(record({ name: 'Testi Asiakas' })));
  return renderTarjousHtml(ctx, sectionHtml ? { attachmentHtml: sectionHtml } : {});
}

describe('generatePdf attachments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    existing.clear();
    mockPrint.mockResolvedValue({ uri: 'file:///cache/Print/abc.pdf', numberOfPages: 2 });
  });

  it('prints the offer with images and does not merge when there is no pdf', async () => {
    const readOfferPdfBytes = jest.fn();
    const writeFinalPdf = jest.fn();
    const deps: AttachmentPdfDeps = {
      loadImageDataUri: async () => PNG,
      readPdfBytes: async () => null,
      readOfferPdfBytes,
      writeFinalPdf,
    };
    const result = await generatePdf({
      html: '',
      fileName: 'Tarjous.pdf',
      calculationId: 'c1',
      documentId: 'd1',
      composeHtml: offerHtml,
      attachments: {
        items: [attachment({ id: 'img', caption: 'Julkisivu <pohjoinen>', sortOrder: 1 })],
        target: 'offer',
      },
      attachmentDeps: deps,
    });
    const html = mockPrint.mock.calls[0][0].html as string;
    expect(html.indexOf('class="liitteet page-break"')).toBeGreaterThan(html.indexOf('class="ktv-page page-break"'));
    expect(html).toContain('Kuva 1. Julkisivu &lt;pohjoinen&gt;');
    expect(html).toContain(PNG);
    expect(html).toContain('"Sivu " counter(page) "/" counter(pages)');
    expect(readOfferPdfBytes).not.toHaveBeenCalled();
    expect(writeFinalPdf).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      uri: 'file:///docs/documents/c1/d1.pdf',
      relativePath: 'documents/c1/d1.pdf',
      numberOfPages: 2,
      warnings: [],
    });
  });

  it('merges a real attachment pdf after the printed offer', async () => {
    const offer = await pdf([[595.28, 841.89]]);
    const attachmentPdf = await pdf([[320, 200], [100, 180]]);
    let written: Uint8Array | null = null;
    const deps: AttachmentPdfDeps = {
      loadImageDataUri: async () => PNG,
      readPdfBytes: async () => attachmentPdf,
      readOfferPdfBytes: async () => offer,
      writeFinalPdf: async (_uri, bytes) => {
        written = bytes;
      },
    };
    const result = await generatePdf({
      html: '',
      fileName: 'Tarjous.pdf',
      calculationId: 'c1',
      documentId: 'd1',
      composeHtml: offerHtml,
      attachments: {
        items: [
          attachment({ id: 'img', caption: 'Julkisivu', sortOrder: 0 }),
          attachment({ id: 'pdf', kind: 'pdf', caption: 'Esimerkki-liite', sortOrder: 1, mime: 'application/pdf' }),
        ],
        target: 'offer',
      },
      attachmentDeps: deps,
    });
    const html = mockPrint.mock.calls[0][0].html as string;
    expect(html).toContain('Liitteenä: Esimerkki-liite');
    expect(html).toContain('Kuva 1. Julkisivu');
    expect(written).not.toBeNull();
    const merged = await PDFDocument.load(written!);
    expect(merged.isEncrypted).toBe(false);
    expect(merged.getPageCount()).toBe(3);
    expect(merged.getPages().map((page) => [page.getWidth(), page.getHeight()])).toEqual([
      [595.28, 841.89],
      [320, 200],
      [100, 180],
    ]);
    expect(result.numberOfPages).toBe(4);
    expect(result.warnings).toEqual([]);
    expect(result.uri).toBe('file:///docs/documents/c1/d1.pdf');
  });

  it('keeps the offer and returns a warning when the merge fails', async () => {
    const offer = await pdf([[595.28, 841.89]]);
    const writeFinalPdf = jest.fn();
    const deps: AttachmentPdfDeps = {
      loadImageDataUri: async () => null,
      readPdfBytes: async () => new Uint8Array([1, 2, 3]),
      readOfferPdfBytes: async () => offer,
      writeFinalPdf,
    };
    const result = await generatePdf({
      html: '<p>runko</p>',
      fileName: 'Tarjous.pdf',
      calculationId: 'c1',
      documentId: 'd1',
      attachments: {
        items: [attachment({ id: 'pdf', kind: 'pdf', caption: 'Rikkinäinen', sortOrder: 0 })],
        target: 'offer',
      },
      attachmentDeps: deps,
    });
    expect(writeFinalPdf).not.toHaveBeenCalled();
    expect(result.uri).toBe('file:///docs/documents/c1/d1.pdf');
    expect(result.numberOfPages).toBe(2);
    expect(result.warnings).toEqual([ATTACHMENT_PDF_MERGE_FAILED_MESSAGE]);
    expect(mockPrint.mock.calls[0][0].html).toContain('Liitteenä: Rikkinäinen');
  });

  it('skips a missing image and a missing pdf and still prints the offer', async () => {
    const writeFinalPdf = jest.fn();
    const deps: AttachmentPdfDeps = {
      loadImageDataUri: async () => null,
      readPdfBytes: async () => null,
      readOfferPdfBytes: async () => null,
      writeFinalPdf,
    };
    const result = await generatePdf({
      html: '',
      fileName: 'Tarjous.pdf',
      calculationId: 'c1',
      documentId: 'd1',
      composeHtml: offerHtml,
      attachments: {
        items: [
          attachment({ id: 'img', caption: 'Katoava kuva', sortOrder: 0 }),
          attachment({ id: 'pdf', kind: 'pdf', caption: '', sortOrder: 1, fileRelPath: 'attachments/c1/puuttuva.pdf' }),
        ],
        target: 'offer',
      },
      attachmentDeps: deps,
    });
    const html = mockPrint.mock.calls[0][0].html as string;
    expect(html).not.toContain('class="liitteet');
    expect(html).toContain('Tarjous / sopimus');
    expect(html).toBe(offerHtml(''));
    expect(writeFinalPdf).not.toHaveBeenCalled();
    expect(result.warnings).toEqual([
      'Kuvaa ei voitu lisätä: Katoava kuva.',
      'PDF-liitettä ei voitu lukea: puuttuva.pdf. Tarjous voidaan jakaa ilman tätä liitettä.',
    ]);
    expect(result.numberOfPages).toBe(2);
    expect(result.uri).toBe('file:///docs/documents/c1/d1.pdf');
  });
});
