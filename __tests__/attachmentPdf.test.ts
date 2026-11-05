import { PDFDocument, type EncryptionAlgorithm } from '@cantoo/pdf-lib';

import {
  ATTACHMENT_PDF_CORRUPT_MESSAGE,
  ATTACHMENT_PDF_INVALID_MESSAGE,
  ATTACHMENT_PDF_MERGE_FAILED_MESSAGE,
  ATTACHMENT_PDF_PASSWORD_MESSAGE,
  ATTACHMENT_PDF_TOO_LARGE_MESSAGE,
  ATTACHMENT_PDF_TOO_MANY_PAGES_MESSAGE,
  attachmentPdfFailureMessage,
} from '../src/core/attachments/attachmentMessages';
import { mergeOfferPdf, mergeOfferPdfSafe } from '../src/core/attachments/mergeOfferPdf';
import {
  MAX_ATTACHMENT_PDF_BYTES,
  MAX_ATTACHMENT_PDF_PAGES,
  MAX_TOTAL_ATTACHMENT_BYTES,
  checkAttachmentLimits,
  prepareAttachmentPdf,
} from '../src/core/attachments/validateAttachmentPdf';

async function pdf(pages: [number, number][], encrypt?: { ownerPassword: string; userPassword?: string; algorithm?: EncryptionAlgorithm; allowWeakCryptography?: boolean }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const [width, height] of pages) doc.addPage([width, height]);
  if (encrypt) doc.encrypt(encrypt);
  return doc.save();
}

async function sizes(bytes: Uint8Array): Promise<[number, number][]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => [page.getWidth(), page.getHeight()]);
}

describe('attachment PDF merge and validation', () => {
  it('appends pages in order, keeps sizes, and leaves an empty list at the offer page count', async () => {
    const offer = await pdf([[595.28, 841.89]]);
    const letter = await pdf([[792, 612]]);
    const square = await pdf([[320, 320], [100, 200]]);
    const merged = await mergeOfferPdf(offer, [letter, square]);
    expect(merged.addedPages).toBe(3);
    const reloaded = await PDFDocument.load(merged.bytes);
    expect(reloaded.isEncrypted).toBe(false);
    expect(reloaded.getPageCount()).toBe(4);
    expect(await sizes(merged.bytes)).toEqual([
      [595.28, 841.89],
      [792, 612],
      [320, 320],
      [100, 200],
    ]);

    const untouched = await mergeOfferPdf(offer, []);
    expect(untouched.addedPages).toBe(0);
    expect((await PDFDocument.load(untouched.bytes)).getPageCount()).toBe(1);
    expect((await PDFDocument.load(untouched.bytes)).isEncrypted).toBe(false);
  });

  it('accepts an owner-only file for RC4, AES-128 and AES-256 and stores a decrypted copy', async () => {
    const cases: { algorithm?: EncryptionAlgorithm; allowWeakCryptography?: boolean }[] = [
      {},
      { algorithm: 'AES-128' },
      { algorithm: 'RC4-128', allowWeakCryptography: true },
    ];
    for (const options of cases) {
      const encrypted = await pdf([[792, 612]], { ownerPassword: 'omistaja', ...options });
      await expect(PDFDocument.load(encrypted)).rejects.toThrow(/encrypted/i);
      const prepared = await prepareAttachmentPdf(encrypted);
      expect(prepared).toMatchObject({ ok: true, pageCount: 1, wasEncrypted: true });
      if (!prepared.ok) continue;
      const opened = await PDFDocument.load(prepared.bytes);
      expect(opened.isEncrypted).toBe(false);
      expect(opened.getPageCount()).toBe(1);
      expect(opened.getPages()[0]?.getWidth()).toBe(792);
      expect(opened.getPages()[0]?.getHeight()).toBe(612);
    }
  });

  it('rejects a user password and does not ask for one', async () => {
    const encrypted = await pdf([[200, 100]], { ownerPassword: 'omistaja', userPassword: 'salaisuus' });
    const prepared = await prepareAttachmentPdf(encrypted);
    expect(prepared).toEqual({ ok: false, reason: 'password' });
    expect(attachmentPdfFailureMessage('password')).toBe(ATTACHMENT_PDF_PASSWORD_MESSAGE);
  });

  it('rejects a PDF whose page count is not a positive number', async () => {
    const zeroPages = new TextEncoder().encode(
      '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n100\n%%EOF\n',
    );
    expect((await PDFDocument.load(zeroPages)).getPageCount()).toBe(0);
    expect(await prepareAttachmentPdf(zeroPages)).toEqual({ ok: false, reason: 'corrupt' });
    expect(ATTACHMENT_PDF_CORRUPT_MESSAGE).toBe('PDF-tiedosto on vioittunut.');
  });

  it('maps a non-PDF to invalid and a truncated PDF to corrupt', async () => {
    const text = await prepareAttachmentPdf(new TextEncoder().encode('ei ole pdf'));
    expect(text).toEqual({ ok: false, reason: 'invalid' });
    const whole = await pdf([[100, 100]]);
    const truncated = await prepareAttachmentPdf(whole.slice(0, 40));
    expect(truncated).toEqual({ ok: false, reason: 'corrupt' });
    expect(attachmentPdfFailureMessage('invalid')).toBe(ATTACHMENT_PDF_INVALID_MESSAGE);
    expect(attachmentPdfFailureMessage('corrupt')).toBe(ATTACHMENT_PDF_CORRUPT_MESSAGE);
  });

  it('enforces the byte and page limits', async () => {
    expect(checkAttachmentLimits([], { sizeBytes: MAX_ATTACHMENT_PDF_BYTES, pages: 1 })).toEqual({ ok: true });
    expect(checkAttachmentLimits([], { sizeBytes: MAX_ATTACHMENT_PDF_BYTES + 1, pages: 1 })).toEqual({
      ok: false,
      reason: 'too_large',
    });
    expect(
      checkAttachmentLimits([{ sizeBytes: 20 * 1024 * 1024, pages: 1 }], { sizeBytes: 5 * 1024 * 1024 + 1, pages: 1 }),
    ).toEqual({ ok: false, reason: 'too_large' });
    expect(
      checkAttachmentLimits([{ sizeBytes: 15 * 1024 * 1024, pages: 40 }], { sizeBytes: 10 * 1024 * 1024, pages: 10 }),
    ).toEqual({ ok: true });
    expect(checkAttachmentLimits([{ sizeBytes: 100, pages: 40 }], { sizeBytes: 100, pages: 11 })).toEqual({
      ok: false,
      reason: 'too_many_pages',
    });
    expect(checkAttachmentLimits([], { sizeBytes: 100, pages: MAX_ATTACHMENT_PDF_PAGES })).toEqual({ ok: true });
    expect(MAX_TOTAL_ATTACHMENT_BYTES).toBe(25 * 1024 * 1024);

    const oversized = await prepareAttachmentPdf(new Uint8Array(MAX_ATTACHMENT_PDF_BYTES + 1));
    expect(oversized).toEqual({ ok: false, reason: 'too_large' });
    const many = await pdf(Array.from({ length: MAX_ATTACHMENT_PDF_PAGES + 1 }, () => [100, 100]));
    expect(await prepareAttachmentPdf(many)).toEqual({ ok: false, reason: 'too_many_pages' });
    expect(ATTACHMENT_PDF_TOO_LARGE_MESSAGE).toContain('10 Mt');
    expect(ATTACHMENT_PDF_TOO_LARGE_MESSAGE).toContain('25 Mt');
    expect(ATTACHMENT_PDF_TOO_MANY_PAGES_MESSAGE).toContain('50');
  });

  it('merges a decrypted attachment without encryption and falls back when a merge throws', async () => {
    const offer = await pdf([[595.28, 841.89]]);
    const encrypted = await pdf([[792, 612], [400, 400]], { ownerPassword: 'omistaja', algorithm: 'AES-256' });
    const prepared = await prepareAttachmentPdf(encrypted);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const merged = await mergeOfferPdf(offer, [prepared.bytes]);
    expect(merged.addedPages).toBe(2);
    const opened = await PDFDocument.load(merged.bytes);
    expect(opened.isEncrypted).toBe(false);
    expect(opened.getPageCount()).toBe(3);

    const safe = await mergeOfferPdfSafe(offer, [new Uint8Array([1, 2, 3])]);
    expect(safe).toEqual({ ok: false, error: ATTACHMENT_PDF_MERGE_FAILED_MESSAGE });
    const plain = await pdf([[100, 80]]);
    await expect(mergeOfferPdfSafe(offer, [plain])).resolves.toMatchObject({ ok: true, addedPages: 1 });
  });
});
