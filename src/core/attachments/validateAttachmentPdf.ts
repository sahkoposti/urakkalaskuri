import {
  EncryptedPDFError,
  MissingPDFHeaderError,
  PDFDocument,
  PDFParsingError,
} from '@cantoo/pdf-lib';

export const MAX_ATTACHMENT_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_ATTACHMENT_PDF_PAGES = 50;

export type AttachmentLimitItem = { sizeBytes: number; pages: number };

export type AttachmentPdfFailureReason = 'password' | 'invalid' | 'corrupt' | 'too_large' | 'too_many_pages';

export type PrepareAttachmentPdfResult =
  | { ok: true; bytes: Uint8Array; pageCount: number; wasEncrypted: boolean }
  | { ok: false; reason: AttachmentPdfFailureReason };

/** Yhden tiedoston ja jo tallennettujen liitteiden rajat. Ei lue PDF:ää. */
export function checkAttachmentLimits(
  existing: readonly AttachmentLimitItem[],
  candidate: AttachmentLimitItem,
): { ok: true } | { ok: false; reason: 'too_large' | 'too_many_pages' } {
  if (candidate.sizeBytes > MAX_ATTACHMENT_PDF_BYTES) return { ok: false, reason: 'too_large' };
  const totalBytes = existing.reduce((sum, item) => sum + item.sizeBytes, 0) + candidate.sizeBytes;
  if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) return { ok: false, reason: 'too_large' };
  const totalPages = existing.reduce((sum, item) => sum + item.pages, 0) + candidate.pages;
  if (totalPages > MAX_ATTACHMENT_PDF_PAGES) return { ok: false, reason: 'too_many_pages' };
  return { ok: true };
}

function failureReason(error: unknown): 'password' | 'invalid' | 'corrupt' {
  if (
    error instanceof Error &&
    (error.message.includes('Password incorrect') || error.message.includes('NEEDS PASSWORD'))
  ) {
    return 'password';
  }
  if (error instanceof MissingPDFHeaderError || error instanceof PDFParsingError) return 'invalid';
  return 'corrupt';
}

async function loadAttachment(bytes: Uint8Array): Promise<{ doc: PDFDocument; wasEncrypted: boolean }> {
  try {
    return { doc: await PDFDocument.load(bytes), wasEncrypted: false };
  } catch (error) {
    if (!(error instanceof EncryptedPDFError)) throw error;
    const doc = await PDFDocument.load(bytes, { password: '' });
    return { doc, wasEncrypted: true };
  }
}

/** Salasanaton kopio. Omistajan salasana (tyhjä käyttäjäsalasana) avataan, käyttäjän salasana hylätään. */
export async function prepareAttachmentPdf(bytes: Uint8Array): Promise<PrepareAttachmentPdfResult> {
  if (bytes.byteLength > MAX_ATTACHMENT_PDF_BYTES) return { ok: false, reason: 'too_large' };
  try {
    const loaded = await loadAttachment(bytes);
    const pageCount = loaded.doc.getPageCount();
    if (pageCount > MAX_ATTACHMENT_PDF_PAGES) return { ok: false, reason: 'too_many_pages' };
    const copy = await PDFDocument.create();
    const pages = await copy.copyPages(loaded.doc, loaded.doc.getPageIndices());
    for (const page of pages) copy.addPage(page);
    return { ok: true, bytes: await copy.save(), pageCount, wasEncrypted: loaded.wasEncrypted };
  } catch (error) {
    return { ok: false, reason: failureReason(error) };
  }
}
