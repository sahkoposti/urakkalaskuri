import { printToFileAsync } from 'expo-print';

import { defaultAttachmentPdfDeps } from '@/src/core/attachments/attachmentPdfIo';
import { ATTACHMENT_PDF_MERGE_FAILED_MESSAGE } from '@/src/core/attachments/attachmentMessages';
import { appendAttachmentSection } from '@/src/core/attachments/attachmentSectionHtml';
import { mergeOfferPdfSafe } from '@/src/core/attachments/mergeOfferPdf';
import {
  prepareAttachmentPrint,
  type AttachmentPdfDeps,
} from '@/src/core/attachments/prepareAttachmentPrint';
import {
  DEFAULT_ATTACHMENT_PAGE_LAYOUT,
  type AttachmentSectionLayout,
  type AttachmentTarget,
} from '@/src/core/attachments/attachmentPrintPlan';
import type { Attachment } from '@/src/core/attachments/types';
import { placePrintedPdf } from '@/src/core/documents/documentFiles';

/** A4 pystyssä, 72 PPI (expo-print käyttää pikseleitä). */
export const A4_PORTRAIT = { width: 595, height: 842 } as const;

export type GeneratePdfAttachmentInput = {
  items: readonly Attachment[];
  target: AttachmentTarget;
  layout?: AttachmentSectionLayout;
};

export type GeneratePdfOptions = {
  html: string;
  fileName: string;
  calculationId: string;
  documentId: string;
  /**
   * Liitteet. composeHtml rakentaa koko dokumentin (osio mukana tai tyhjä).
   * Ilman composeHtml:ta osio liitetään html-rungon loppuun.
   */
  attachments?: GeneratePdfAttachmentInput;
  composeHtml?: (sectionHtml: string) => string;
  attachmentDeps?: AttachmentPdfDeps;
};

export type GeneratePdfResult = {
  uri: string;
  relativePath: string;
  numberOfPages: number;
  fileName: string;
  warnings: string[];
};

/**
 * html → printToFileAsync → siirto Paths.document/documents/<laskelma>/<id>.pdf.
 * PDF-liitteet yhdistetään perään. Epäonnistunut yhdistäminen jättää tulosteen
 * ja palauttaa suomenkielisen varoituksen. Jako ei käynnisty tästä.
 */
export async function generatePdf(options: GeneratePdfOptions): Promise<GeneratePdfResult> {
  const warnings: string[] = [];
  let html = options.html;
  let pdfBytes: Uint8Array[] = [];
  const deps = options.attachments ? (options.attachmentDeps ?? defaultAttachmentPdfDeps()) : null;
  if (options.attachments && deps) {
    const prepared = await prepareAttachmentPrint(
      options.attachments.items,
      options.attachments.target,
      deps,
      options.attachments.layout ?? DEFAULT_ATTACHMENT_PAGE_LAYOUT,
    );
    warnings.push(...prepared.warnings);
    pdfBytes = prepared.pdfBytes;
    html = options.composeHtml
      ? options.composeHtml(prepared.html)
      : appendAttachmentSection(options.html, prepared.html);
  }

  const printed = await printToFileAsync({
    html,
    width: A4_PORTRAIT.width,
    height: A4_PORTRAIT.height,
  });
  const placed = placePrintedPdf(printed.uri, options.calculationId, options.documentId);
  let numberOfPages = printed.numberOfPages;
  if (pdfBytes.length > 0 && deps) {
    const merged = await appendPdfAttachments(placed.uri, pdfBytes, deps);
    if (merged.warning) warnings.push(merged.warning);
    else numberOfPages += merged.addedPages;
  }
  return {
    uri: placed.uri,
    relativePath: placed.relativePath,
    numberOfPages,
    fileName: options.fileName,
    warnings,
  };
}

async function appendPdfAttachments(
  uri: string,
  pdfBytes: Uint8Array[],
  deps: Pick<AttachmentPdfDeps, 'readOfferPdfBytes' | 'writeFinalPdf'>,
): Promise<{ addedPages: number; warning?: string }> {
  try {
    const offerBytes = await deps.readOfferPdfBytes(uri);
    if (!offerBytes) return { addedPages: 0, warning: ATTACHMENT_PDF_MERGE_FAILED_MESSAGE };
    const merged = await mergeOfferPdfSafe(offerBytes, pdfBytes);
    if (!merged.ok) return { addedPages: 0, warning: merged.error };
    await deps.writeFinalPdf(uri, merged.bytes);
    return { addedPages: merged.addedPages };
  } catch {
    return { addedPages: 0, warning: ATTACHMENT_PDF_MERGE_FAILED_MESSAGE };
  }
}
