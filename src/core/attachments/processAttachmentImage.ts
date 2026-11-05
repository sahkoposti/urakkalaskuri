import { ATTACHMENT_IMAGE_PROCESS_FAILED_MESSAGE } from './attachmentMessages';
import {
  ATTACHMENT_IMAGE_JPEG_QUALITY,
  imageResizePlan,
  type ImageResizePlan,
} from './attachmentPrintPlan';

export type ImageManipulateRequest = {
  uri: string;
  /** null = ei skaalata, tiedosto kirjoitetaan silti uudelleen (EXIF pois, JPEG). */
  resize: { width: number; height: number } | null;
  quality: number;
};

export type ImageManipulateResult = {
  uri: string;
  width: number;
  height: number;
};

export type ImageManipulator = (request: ImageManipulateRequest) => Promise<ImageManipulateResult>;

/**
 * Jo tallennettu JPEG, jonka mitat mahtuvat rajaan, luetaan sellaisenaan.
 * Muuten kuva kirjoitetaan uudeksi JPEG:ksi.
 */
export function attachmentImageNeedsProcessing(
  width: number | null,
  height: number | null,
  mime: string,
): boolean {
  if (mime.trim().toLowerCase() !== 'image/jpeg' && mime.trim().toLowerCase() !== 'image/jpg') return true;
  const plan = imageResizePlan(width ?? Number.NaN, height ?? Number.NaN);
  if (!plan) return true;
  return plan.resized;
}

function resizeOf(plan: ImageResizePlan | null): { width: number; height: number } | null {
  if (!plan?.resized) return null;
  return { width: plan.width, height: plan.height };
}

/**
 * Pisimmäksi sivuksi enintään 1600 px, JPEG-laatu 0,7, ei suurenneta.
 * Uusi tiedosto kirjoitetaan aina, joten EXIF ei siirry.
 */
export async function processAttachmentImage(
  source: { uri: string; width: number | null; height: number | null },
  manipulate: ImageManipulator,
): Promise<{ ok: true; uri: string; width: number; height: number } | { ok: false; message: string }> {
  try {
    const known = imageResizePlan(source.width ?? Number.NaN, source.height ?? Number.NaN);
    let current = await manipulate({
      uri: source.uri,
      resize: resizeOf(known),
      quality: ATTACHMENT_IMAGE_JPEG_QUALITY,
    });
    if (!known) {
      const measured = imageResizePlan(current.width, current.height);
      if (measured?.resized) {
        current = await manipulate({
          uri: current.uri,
          resize: { width: measured.width, height: measured.height },
          quality: ATTACHMENT_IMAGE_JPEG_QUALITY,
        });
      }
    }
    if (!Number.isFinite(current.width) || !Number.isFinite(current.height) || current.width <= 0 || current.height <= 0) {
      return { ok: false, message: ATTACHMENT_IMAGE_PROCESS_FAILED_MESSAGE };
    }
    return { ok: true, uri: current.uri, width: current.width, height: current.height };
  } catch {
    return { ok: false, message: ATTACHMENT_IMAGE_PROCESS_FAILED_MESSAGE };
  }
}
