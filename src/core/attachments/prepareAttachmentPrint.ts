import {
  attachmentImagesCappedMessage,
  attachmentImageMissingMessage,
  attachmentImageSectionTooLargeMessage,
  attachmentPdfMissingMessage,
} from './attachmentMessages';
import {
  attachmentDisplayName,
  attachmentsForDestination,
  capAttachmentImages,
  DEFAULT_ATTACHMENT_PAGE_LAYOUT,
  estimateImageSectionBytes,
  imageSectionExceedsWarning,
  splitAttachments,
  type AttachmentPageLayout,
  type AttachmentTarget,
} from './attachmentPrintPlan';
import { renderAttachmentSectionHtml } from './attachmentSectionHtml';
import type { Attachment } from './types';

export type AttachmentPdfDeps = {
  /** Kuvan data-URI. null = tiedosto puuttuu tai ei ole luettavissa. Pienennys on toteuttajan asia (L4). */
  loadImageDataUri: (attachment: Attachment) => Promise<string | null>;
  /** PDF:n tavut. null = tiedosto puuttuu tai ei ole luettavissa. */
  readPdfBytes: (attachment: Attachment) => Promise<Uint8Array | null>;
  /** Tulostetun tarjouksen tavut yhdistämistä varten. */
  readOfferPdfBytes: (uri: string) => Promise<Uint8Array | null>;
  /** Kirjoittaa yhdistetyn PDF:n saman tiedoston päälle. */
  writeFinalPdf: (uri: string, bytes: Uint8Array) => Promise<void>;
};

export type PreparedAttachmentPrint = {
  html: string;
  pdfBytes: Uint8Array[];
  warnings: string[];
  skippedImages: Attachment[];
  imageSectionTooLarge: boolean;
};

async function readOrNull<T>(read: () => Promise<T | null>): Promise<T | null> {
  try {
    return (await read()) || null;
  } catch {
    return null;
  }
}

/**
 * Valitsee kohteen liitteet, rajaa kuvat, lataa data-URI:t ja PDF-tavut.
 * Puuttuva tiedosto ohitetaan ja siitä tulee varoitus. Ei heitä.
 */
export async function prepareAttachmentPrint(
  items: readonly Attachment[],
  target: AttachmentTarget,
  deps: Pick<AttachmentPdfDeps, 'loadImageDataUri' | 'readPdfBytes'>,
  layout: AttachmentPageLayout = DEFAULT_ATTACHMENT_PAGE_LAYOUT,
): Promise<PreparedAttachmentPrint> {
  const selected = attachmentsForDestination(items, target);
  const { images, pdfs } = splitAttachments(selected);
  const { kept, skipped } = capAttachmentImages(images);
  const warnings: string[] = [];
  if (skipped.length > 0) warnings.push(attachmentImagesCappedMessage(skipped.length));
  const estimated = estimateImageSectionBytes(kept.map((image) => image.sizeBytes));
  const imageSectionTooLarge = kept.length > 0 && imageSectionExceedsWarning(estimated);
  if (imageSectionTooLarge) warnings.push(attachmentImageSectionTooLargeMessage());

  const loadedImages: { dataUri: string; caption: string }[] = [];
  for (const image of kept) {
    const dataUri = await readOrNull(() => deps.loadImageDataUri(image));
    if (!dataUri) {
      warnings.push(attachmentImageMissingMessage(attachmentDisplayName(image)));
      continue;
    }
    loadedImages.push({ dataUri, caption: image.caption });
  }

  const pdfBytes: Uint8Array[] = [];
  const pdfNames: { name: string }[] = [];
  for (const pdf of pdfs) {
    const bytes = await readOrNull(() => deps.readPdfBytes(pdf));
    if (!bytes) {
      warnings.push(attachmentPdfMissingMessage(attachmentDisplayName(pdf)));
      continue;
    }
    pdfBytes.push(bytes);
    pdfNames.push({ name: attachmentDisplayName(pdf) });
  }

  return {
    html: renderAttachmentSectionHtml({ images: loadedImages, pdfs: pdfNames, layout }),
    pdfBytes,
    warnings,
    skippedImages: skipped,
    imageSectionTooLarge,
  };
}
