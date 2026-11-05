import { PDFDocument } from '@cantoo/pdf-lib';

import { attachmentDestinationCounts } from '@/src/core/attachments/attachmentCounts';
import {
  ATTACHMENT_COPY_FAILED_MESSAGE,
  ATTACHMENT_FILE_KIND_MESSAGE,
  ATTACHMENT_IMAGE_PROCESS_FAILED_MESSAGE,
  ATTACHMENT_IMAGES_FULL_MESSAGE,
  ATTACHMENT_PDF_TOO_LARGE_MESSAGE,
  ATTACHMENT_PDF_TOO_MANY_PAGES_MESSAGE,
  ATTACHMENT_REMOVE_COPIED_LABEL,
  attachmentCountLabel,
  attachmentPdfFailureMessage,
} from '@/src/core/attachments/attachmentMessages';
import {
  calculationWithAttachmentPageLayout,
  readAttachmentPageLayout,
} from '@/src/core/attachments/attachmentPageLayout';
import { ATTACHMENT_IMAGE_JPEG_QUALITY } from '@/src/core/attachments/attachmentPrintPlan';
import { clampCaption } from '@/src/core/attachments/attachmentCaption';
import { calculationCopyNotice, commitCalculationCopy } from '@/src/core/attachments/commitCalculationCopy';
import {
  ingestPickedAttachment,
  type IngestAttachmentDeps,
  type PickedAttachment,
} from '@/src/core/attachments/ingestAttachment';
import { pickedFileKind } from '@/src/core/attachments/pickedFileKind';
import {
  attachmentImageNeedsProcessing,
  processAttachmentImage,
  type ImageManipulator,
} from '@/src/core/attachments/processAttachmentImage';
import { ATTACHMENT_CAPTION_MAX, type Attachment } from '@/src/core/attachments/types';
import type { CalculationRecord } from '@/src/core/models/types';

function item(partial: Partial<Attachment> & Pick<Attachment, 'id' | 'kind'>): Attachment {
  return {
    calculationId: 'c1',
    fileRelPath: `attachments/c1/${partial.id}.jpg`,
    mime: partial.kind === 'pdf' ? 'application/pdf' : 'image/jpeg',
    width: partial.kind === 'image' ? 100 : null,
    height: partial.kind === 'image' ? 80 : null,
    sizeBytes: 100,
    caption: '',
    destination: 'none',
    sortOrder: 0,
    createdAt: '2026-11-05T10:00:00.000Z',
    ...partial,
  };
}

function picked(partial: Partial<PickedAttachment> = {}): PickedAttachment {
  return {
    uri: 'file:///tmp/kuva.jpg',
    name: 'kuva.jpg',
    mime: 'image/jpeg',
    width: 100,
    height: 80,
    ...partial,
  };
}

function manipulator(
  impl: (request: Parameters<ImageManipulator>[0]) => { uri: string; width: number; height: number },
): ImageManipulator {
  return async (request) => impl(request);
}

describe('processAttachmentImage', () => {
  it('jättää pienen kuvan ennalleen ja käyttää laatua 0,7', async () => {
    const calls: unknown[] = [];
    const result = await processAttachmentImage(
      { uri: 'file:///a.jpg', width: 100, height: 80 },
      manipulator((request) => {
        calls.push(request);
        return { uri: 'file:///out.jpg', width: 100, height: 80 };
      }),
    );
    expect(result).toEqual({ ok: true, uri: 'file:///out.jpg', width: 100, height: 80 });
    expect(calls).toEqual([
      { uri: 'file:///a.jpg', resize: null, quality: ATTACHMENT_IMAGE_JPEG_QUALITY },
    ]);
    expect(attachmentImageNeedsProcessing(100, 80, 'image/jpeg')).toBe(false);
  });

  it('pienentää pitkän sivun 1600 pikseliin', async () => {
    let resize: unknown;
    const result = await processAttachmentImage(
      { uri: 'file:///iso.png', width: 3200, height: 1600 },
      manipulator((request) => {
        resize = request.resize;
        return { uri: 'file:///pieni.jpg', width: 1600, height: 800 };
      }),
    );
    expect(result).toEqual({ ok: true, uri: 'file:///pieni.jpg', width: 1600, height: 800 });
    expect(resize).toEqual({ width: 1600, height: 800 });
    expect(attachmentImageNeedsProcessing(100, 80, 'image/png')).toBe(true);
    expect(attachmentImageNeedsProcessing(3200, 1600, 'image/jpeg')).toBe(true);
  });

  it('mittaa tuntemattoman kuvan ja pienentää tarvittaessa toisella kutsulla', async () => {
    const uris: string[] = [];
    const result = await processAttachmentImage(
      { uri: 'file:///tuntematon.heic', width: null, height: null },
      manipulator((request) => {
        uris.push(request.uri);
        if (request.resize == null) return { uri: 'file:///mitattu.jpg', width: 4000, height: 2000 };
        expect(request.resize).toEqual({ width: 1600, height: 800 });
        return { uri: 'file:///valmis.jpg', width: 1600, height: 800 };
      }),
    );
    expect(result).toEqual({ ok: true, uri: 'file:///valmis.jpg', width: 1600, height: 800 });
    expect(uris).toEqual(['file:///tuntematon.heic', 'file:///mitattu.jpg']);
  });

  it('palauttaa suomenkielisen virheen, jos käsittely kaatuu', async () => {
    const result = await processAttachmentImage(
      { uri: 'file:///a.jpg', width: 10, height: 10 },
      async () => {
        throw new Error('native');
      },
    );
    expect(result).toEqual({ ok: false, message: ATTACHMENT_IMAGE_PROCESS_FAILED_MESSAGE });
  });
});

describe('pickedFileKind', () => {
  it('tunnistaa pdf:n ja kuvan', () => {
    expect(pickedFileKind('application/pdf', 'a.pdf')).toBe('pdf');
    expect(pickedFileKind('', 'raportti.PDF')).toBe('pdf');
    expect(pickedFileKind('image/jpeg', 'a.jpg')).toBe('image');
    expect(pickedFileKind('', 'kuva.heic')).toBe('image');
    expect(pickedFileKind('text/plain', 'muistio.txt')).toBeNull();
  });
});

describe('attachment counts and layout', () => {
  it('laskee tarjouksen ja kortin', () => {
    const attachments = [
      item({ id: '1', kind: 'image', destination: 'offer' }),
      item({ id: '2', kind: 'image', destination: 'both' }),
      item({ id: '3', kind: 'pdf', destination: 'card' }),
      item({ id: '4', kind: 'pdf', destination: 'none' }),
    ];
    expect(attachmentDestinationCounts(attachments)).toEqual({ offer: 2, card: 2 });
    expect(attachmentCountLabel({ offer: 2, card: 2 })).toBe('Liitteet: 2 tarjoukseen, 2 kortille');
  });

  it('tallentaa vain poikkeavan asettelun', () => {
    expect(readAttachmentPageLayout(undefined)).toBe('two_per_page');
    const base = { formId: 'x', formVersion: 1, fields: [] };
    const one = calculationWithAttachmentPageLayout(
      { formSnapshot: base } as unknown as CalculationRecord,
      'one_per_page',
    );
    expect(one.formSnapshot?.attachmentPageLayout).toBe('one_per_page');
    const back = calculationWithAttachmentPageLayout(one, 'two_per_page');
    expect(back.formSnapshot).not.toHaveProperty('attachmentPageLayout');
    expect(clampCaption('ä'.repeat(ATTACHMENT_CAPTION_MAX + 1)).length).toBe(ATTACHMENT_CAPTION_MAX);
  });
});

describe('ingestPickedAttachment', () => {
  function deps(overrides: Partial<IngestAttachmentDeps> = {}): IngestAttachmentDeps {
    return {
      createId: () => 'new-1',
      listAttachments: async () => [],
      manipulate: manipulator(() => ({ uri: 'file:///out.jpg', width: 100, height: 80 })),
      fileSize: async () => 1000,
      readBytes: async () => null,
      pdfPageCount: async () => 0,
      placeImage: () => 'attachments/c1/new-1.jpg',
      writePdf: () => 'attachments/c1/new-1.pdf',
      addAttachment: async () => item({ id: 'new-1', kind: 'image' }),
      removeStored: () => undefined,
      ...overrides,
    };
  }

  it('hylkää 21. kuvan ennen käsittelyä', async () => {
    let called = false;
    const result = await ingestPickedAttachment(
      'c1',
      picked(),
      deps({
        listAttachments: async () =>
          Array.from({ length: 20 }, (_, index) => item({ id: String(index), kind: 'image' })),
        manipulate: async () => {
          called = true;
          return { uri: 'x', width: 1, height: 1 };
        },
      }),
    );
    expect(result).toEqual({ ok: false, message: ATTACHMENT_IMAGES_FULL_MESSAGE });
    expect(called).toBe(false);
  });

  it('hylkää liian ison kuvan kokorajan mukaan', async () => {
    let placed = false;
    const result = await ingestPickedAttachment(
      'c1',
      picked(),
      deps({
        listAttachments: async () => [item({ id: 'old', kind: 'image', sizeBytes: 20 * 1024 * 1024 })],
        fileSize: async () => 6 * 1024 * 1024,
        placeImage: () => {
          placed = true;
          return 'attachments/c1/new-1.jpg';
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe(attachmentPdfFailureMessage('too_large'));
    expect(placed).toBe(false);
    expect(ATTACHMENT_PDF_TOO_LARGE_MESSAGE).toContain('10 Mt');
  });

  it('tallentaa käsitellyn jpeg-kuvan', async () => {
    const added: unknown[] = [];
    const result = await ingestPickedAttachment(
      'c1',
      picked({ mime: 'image/png', width: 3200, height: 1600 }),
      deps({
        manipulate: manipulator((request) => {
          expect(request.resize).toEqual({ width: 1600, height: 800 });
          return { uri: 'file:///out.jpg', width: 1600, height: 800 };
        }),
        addAttachment: async (input) => {
          added.push(input);
          return item({ id: input.id, kind: 'image' });
        },
      }),
    );
    expect(result.ok).toBe(true);
    expect(added[0]).toMatchObject({
      mime: 'image/jpeg',
      width: 1600,
      height: 800,
      sizeBytes: 1000,
      fileRelPath: 'attachments/c1/new-1.jpg',
    });
  });

  it('siivoaa tiedoston, jos kuvan lisäys kantaan epäonnistuu', async () => {
    const removed: string[] = [];
    const result = await ingestPickedAttachment(
      'c1',
      picked(),
      deps({
        addAttachment: async () => {
          throw new Error('db');
        },
        removeStored: (path) => {
          removed.push(path);
        },
      }),
    );
    expect(result).toEqual({ ok: false, message: ATTACHMENT_IMAGE_PROCESS_FAILED_MESSAGE });
    expect(removed).toEqual(['attachments/c1/new-1.jpg']);
  });

  it('hyväksyy puhtaan PDF:n ja hylkää käyttäjäsalasanan', async () => {
    const plain = await PDFDocument.create();
    plain.addPage([200, 200]);
    const plainBytes = await plain.save();
    const written: Uint8Array[] = [];
    const ok = await ingestPickedAttachment(
      'c1',
      picked({ name: 'liite.pdf', mime: 'application/pdf' }),
      deps({
        readBytes: async () => plainBytes,
        writePdf: (_calculationId, _id, bytes) => {
          written.push(bytes);
          return 'attachments/c1/new-1.pdf';
        },
        addAttachment: async (input) => item({ id: input.id, kind: 'pdf', sizeBytes: input.sizeBytes }),
      }),
    );
    expect(ok.ok).toBe(true);
    const reloaded = await PDFDocument.load(written[0]);
    expect(reloaded.getPageCount()).toBe(1);

    const locked = await PDFDocument.create();
    locked.addPage();
    locked.encrypt({ userPassword: 'salaisuus', ownerPassword: 'omistaja' });
    const lockedBytes = await locked.save();
    const rejected = await ingestPickedAttachment(
      'c1',
      picked({ name: 'salainen.pdf', mime: 'application/pdf' }),
      deps({ readBytes: async () => lockedBytes }),
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.message).toBe(attachmentPdfFailureMessage('password'));
  });

  it('hylkää PDF:n, kun sivuja on yli 50', async () => {
    const plain = await PDFDocument.create();
    plain.addPage();
    const bytes = await plain.save();
    const existing = item({ id: 'old', kind: 'pdf', sizeBytes: 10 });
    const result = await ingestPickedAttachment(
      'c1',
      picked({ name: 'liite.pdf', mime: 'application/pdf' }),
      deps({
        listAttachments: async () => [existing],
        readBytes: async () => bytes,
        pdfPageCount: async () => 50,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe(ATTACHMENT_PDF_TOO_MANY_PAGES_MESSAGE);
  });

  it('hylkää muun tiedoston', async () => {
    const result = await ingestPickedAttachment('c1', picked({ name: 'a.txt', mime: 'text/plain' }), deps());
    expect(result).toEqual({ ok: false, message: ATTACHMENT_FILE_KIND_MESSAGE });
  });
});

describe('commitCalculationCopy', () => {
  const source = { id: 'source' } as CalculationRecord;

  it('tallentaa kopion ja siivoaa, jos tallennus epäonnistuu', async () => {
    const removed: string[] = [];
    const result = await commitCalculationCopy(source, {
      newId: () => 'copy-1',
      copyCalculationRecord: async () => ({
        record: { id: 'copy-1' } as CalculationRecord,
        attachmentCopyFailures: [],
      }),
      saveCalculation: async () => {
        throw new Error('disk');
      },
      removeAllAttachments: async (id) => {
        removed.push(id);
      },
      listAttachments: async () => [],
    });
    expect(result).toEqual({ ok: false, message: ATTACHMENT_COPY_FAILED_MESSAGE });
    expect(removed).toEqual(['copy-1']);
  });

  it('kertoo kopioidut ja epäonnistuneet liitteet', async () => {
    const result = await commitCalculationCopy(source, {
      newId: () => 'copy-1',
      copyCalculationRecord: async () => ({
        record: { id: 'copy-1' } as CalculationRecord,
        attachmentCopyFailures: [{ sourceId: 'a', message: 'Kuvaa ei kopioitu.' }],
      }),
      saveCalculation: async () => undefined,
      removeAllAttachments: async () => undefined,
      listAttachments: async () => [item({ id: 'b', kind: 'image' })],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.offerRemove).toBe(true);
      expect(result.copiedCount).toBe(1);
      expect(result.message).toContain('Liitteet kopioitiin mukaan.');
      expect(result.message).toContain('Kuvaa ei kopioitu.');
      expect(calculationCopyNotice(1, [{ sourceId: 'a', message: 'Kuvaa ei kopioitu.' }]).message).toBe(
        result.message,
      );
      expect(ATTACHMENT_REMOVE_COPIED_LABEL).toBe('Poista kopioidut liitteet');
    }
  });
});
