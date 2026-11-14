import type { Attachment, AttachmentDestination } from './types';

/** Pisimmän sivun enimmäispituus. Pienempää kuvaa ei suurenneta. */
export const ATTACHMENT_IMAGE_MAX_LONG_SIDE_PX = 1600;
/** JPEG-laatu pienennöksessä. L4 tekee pikselityön; tämä on pelkkä päätös. */
export const ATTACHMENT_IMAGE_JPEG_QUALITY = 0.7;
/** Kuvaa per PDF. Ylimääräiset jätetään pois ja kerrotaan tuloksessa. */
export const ATTACHMENT_MAX_IMAGES_PER_PDF = 20;
/** Base64-arvion raja. Ylitys on varoitus, ei esto. */
export const ATTACHMENT_IMAGE_SECTION_WARN_BYTES = 15 * 1024 * 1024;

export type AttachmentPageLayout = 'two_per_page' | 'one_per_page';
/** Kortin tuloste. Ei tallenneta form_snapshotiin. */
export type AttachmentSectionLayout = AttachmentPageLayout | 'card_grid';
export const DEFAULT_ATTACHMENT_PAGE_LAYOUT: AttachmentPageLayout = 'two_per_page';
export const ATTACHMENT_CARD_IMAGES_PER_PAGE = 4;

export type AttachmentTarget = 'offer' | 'card';

export type ImageResizePlan = {
  width: number;
  height: number;
  quality: number;
  resized: boolean;
};

export function attachmentMatchesDestination(
  destination: AttachmentDestination,
  target: AttachmentTarget,
): boolean {
  if (target === 'offer') return destination === 'offer' || destination === 'both';
  return destination === 'card' || destination === 'both';
}

/** Kohteen liitteet sort_order-järjestyksessä. none jää pois. */
export function attachmentsForDestination(
  items: readonly Attachment[],
  target: AttachmentTarget,
): Attachment[] {
  return items
    .filter((item) => attachmentMatchesDestination(item.destination, target))
    .slice()
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
}

export function splitAttachments(items: readonly Attachment[]): { images: Attachment[]; pdfs: Attachment[] } {
  return {
    images: items.filter((item) => item.kind === 'image'),
    pdfs: items.filter((item) => item.kind === 'pdf'),
  };
}

export function imagesPerPage(layout: AttachmentSectionLayout = DEFAULT_ATTACHMENT_PAGE_LAYOUT): number {
  if (layout === 'card_grid') return ATTACHMENT_CARD_IMAGES_PER_PAGE;
  return layout === 'one_per_page' ? 1 : 2;
}

/**
 * Mitat ja laatu leveydestä ja korkeudesta. Pisimmäksi sivuksi enintään 1600 px.
 * Ei suurenna. Laatu on aina 0,7. Kelvoton mitta palauttaa null.
 */
export function imageResizePlan(width: number, height: number): ImageResizePlan | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const quality = ATTACHMENT_IMAGE_JPEG_QUALITY;
  const longest = Math.max(width, height);
  if (longest <= ATTACHMENT_IMAGE_MAX_LONG_SIDE_PX) {
    return { width, height, quality, resized: false };
  }
  const scale = ATTACHMENT_IMAGE_MAX_LONG_SIDE_PX / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    quality,
    resized: true,
  };
}

/** Base64 kasvattaa tavut noin suhteessa 4/3. */
export function estimateImageSectionBytes(sizeBytes: readonly number[]): number {
  const raw = sizeBytes.reduce((sum, size) => {
    if (!Number.isFinite(size) || size <= 0) return sum;
    return sum + size;
  }, 0);
  return Math.ceil((raw * 4) / 3);
}

export function imageSectionExceedsWarning(estimatedBytes: number): boolean {
  return estimatedBytes > ATTACHMENT_IMAGE_SECTION_WARN_BYTES;
}

export function capAttachmentImages<T>(
  images: readonly T[],
  max = ATTACHMENT_MAX_IMAGES_PER_PDF,
): { kept: T[]; skipped: T[] } {
  const limit = Math.max(0, Math.trunc(max));
  return { kept: images.slice(0, limit), skipped: images.slice(limit) };
}

/** Kuvateksti, tai tiedoston nimi jos kuvateksti on tyhjä. */
export function attachmentDisplayName(attachment: Pick<Attachment, 'caption' | 'fileRelPath'>): string {
  const caption = attachment.caption.trim();
  if (caption) return caption;
  const name = attachment.fileRelPath.split('/').pop()?.trim();
  return name || attachment.fileRelPath;
}
