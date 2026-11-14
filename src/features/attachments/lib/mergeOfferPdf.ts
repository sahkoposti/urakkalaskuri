import { PDFDocument } from '@cantoo/pdf-lib';

import { ATTACHMENT_PDF_MERGE_FAILED_MESSAGE } from './attachmentMessages';

export type MergeOfferPdfResult = { bytes: Uint8Array; addedPages: number };

export type MergeOfferPdfSafeResult =
  | ({ ok: true } & MergeOfferPdfResult)
  | { ok: false; error: string };

/**
 * Liittää PDF:t tarjouksen perään annetussa järjestyksessä.
 * Sivukoot säilyvät. Alatunnistetta ei leimata, eikä tulosta salata.
 */
export async function mergeOfferPdf(
  offerPdfBytes: Uint8Array,
  attachmentPdfs: Uint8Array[],
): Promise<MergeOfferPdfResult> {
  const offer = await PDFDocument.load(offerPdfBytes);
  let addedPages = 0;
  for (const attachment of attachmentPdfs) {
    const source = await PDFDocument.load(attachment);
    const pages = await offer.copyPages(source, source.getPageIndices());
    for (const page of pages) offer.addPage(page);
    addedPages += pages.length;
  }
  return { bytes: await offer.save(), addedPages };
}

/** Ei heitä. Epäonnistuminen jättää tarjouksen jaettavaksi ilman liitteitä. */
export async function mergeOfferPdfSafe(
  offerPdfBytes: Uint8Array,
  attachmentPdfs: Uint8Array[],
): Promise<MergeOfferPdfSafeResult> {
  try {
    const merged = await mergeOfferPdf(offerPdfBytes, attachmentPdfs);
    return { ok: true, bytes: merged.bytes, addedPages: merged.addedPages };
  } catch {
    return { ok: false, error: ATTACHMENT_PDF_MERGE_FAILED_MESSAGE };
  }
}
