import {
  ATTACHMENT_FILE_KIND_MESSAGE,
  ATTACHMENT_IMAGE_PROCESS_FAILED_MESSAGE,
  ATTACHMENT_IMAGES_FULL_MESSAGE,
  attachmentPdfFailureMessage,
} from './attachmentMessages';
import { pickedFileKind } from './pickedFileKind';
import { processAttachmentImage, type ImageManipulator } from './processAttachmentImage';
import { ATTACHMENT_MAX_IMAGES_PER_PDF } from './attachmentPrintPlan';
import {
  checkAttachmentLimits,
  prepareAttachmentPdf,
  type AttachmentLimitItem,
} from './validateAttachmentPdf';
import type { Attachment } from './types';

export type PickedAttachment = {
  uri: string;
  name: string;
  mime: string;
  width: number | null;
  height: number | null;
};

export type IngestAttachmentDeps = {
  createId: () => string;
  listAttachments: (calculationId: string) => Promise<Attachment[]>;
  manipulate: ImageManipulator;
  fileSize: (uri: string) => Promise<number>;
  readBytes: (uri: string) => Promise<Uint8Array | null>;
  /** Olemassa olevan PDF:n sivumäärä. Epäonnistuminen on 0. */
  pdfPageCount: (attachment: Attachment) => Promise<number>;
  placeImage: (sourceUri: string, calculationId: string, id: string) => string;
  writePdf: (calculationId: string, id: string, bytes: Uint8Array) => string;
  addAttachment: (input: {
    id: string;
    calculationId: string;
    kind: 'image' | 'pdf';
    fileRelPath: string;
    mime: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
  }) => Promise<Attachment>;
  removeStored: (relativePath: string) => void;
};

async function existingLimits(
  items: readonly Attachment[],
  pdfPageCount: (attachment: Attachment) => Promise<number>,
): Promise<AttachmentLimitItem[]> {
  const limits: AttachmentLimitItem[] = [];
  for (const item of items) {
    const pages = item.kind === 'pdf' ? await pdfPageCount(item) : 0;
    limits.push({ sizeBytes: item.sizeBytes, pages });
  }
  return limits;
}

/**
 * Käsittelee yhden valitun tiedoston ja tallentaa vain käsitellyn kopion.
 * Hylkäys palauttaa suomenkielisen viestin eikä heitä.
 */
export async function ingestPickedAttachment(
  calculationId: string,
  picked: PickedAttachment,
  deps: IngestAttachmentDeps,
): Promise<{ ok: true; attachment: Attachment } | { ok: false; message: string }> {
  const kind = pickedFileKind(picked.mime, picked.name);
  if (!kind) return { ok: false, message: ATTACHMENT_FILE_KIND_MESSAGE };
  const existing = await deps.listAttachments(calculationId);
  if (kind === 'image') return ingestImage(calculationId, picked, existing, deps);
  return ingestPdf(calculationId, picked, existing, deps);
}

async function ingestImage(
  calculationId: string,
  picked: PickedAttachment,
  existing: readonly Attachment[],
  deps: IngestAttachmentDeps,
): Promise<{ ok: true; attachment: Attachment } | { ok: false; message: string }> {
  const imageCount = existing.filter((item) => item.kind === 'image').length;
  if (imageCount >= ATTACHMENT_MAX_IMAGES_PER_PDF) {
    return { ok: false, message: ATTACHMENT_IMAGES_FULL_MESSAGE };
  }
  const processed = await processAttachmentImage(
    { uri: picked.uri, width: picked.width, height: picked.height },
    deps.manipulate,
  );
  if (!processed.ok) return processed;
  let sizeBytes = 0;
  try {
    sizeBytes = await deps.fileSize(processed.uri);
  } catch {
    return { ok: false, message: ATTACHMENT_IMAGE_PROCESS_FAILED_MESSAGE };
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, message: ATTACHMENT_IMAGE_PROCESS_FAILED_MESSAGE };
  }
  const limits = checkAttachmentLimits(
    [{ sizeBytes: existing.reduce((sum, item) => sum + item.sizeBytes, 0), pages: 0 }],
    { sizeBytes, pages: 0 },
  );
  if (!limits.ok) return { ok: false, message: attachmentPdfFailureMessage(limits.reason) };
  const id = deps.createId();
  let relativePath = '';
  try {
    relativePath = deps.placeImage(processed.uri, calculationId, id);
    const attachment = await deps.addAttachment({
      id,
      calculationId,
      kind: 'image',
      fileRelPath: relativePath,
      mime: 'image/jpeg',
      sizeBytes,
      width: processed.width,
      height: processed.height,
    });
    return { ok: true, attachment };
  } catch {
    if (relativePath) deps.removeStored(relativePath);
    return { ok: false, message: ATTACHMENT_IMAGE_PROCESS_FAILED_MESSAGE };
  }
}

async function ingestPdf(
  calculationId: string,
  picked: PickedAttachment,
  existing: readonly Attachment[],
  deps: IngestAttachmentDeps,
): Promise<{ ok: true; attachment: Attachment } | { ok: false; message: string }> {
  const bytes = await deps.readBytes(picked.uri);
  if (!bytes) return { ok: false, message: attachmentPdfFailureMessage('invalid') };
  const prepared = await prepareAttachmentPdf(bytes);
  if (!prepared.ok) return { ok: false, message: attachmentPdfFailureMessage(prepared.reason) };
  const limits = checkAttachmentLimits(await existingLimits(existing, deps.pdfPageCount), {
    sizeBytes: prepared.bytes.byteLength,
    pages: prepared.pageCount,
  });
  if (!limits.ok) return { ok: false, message: attachmentPdfFailureMessage(limits.reason) };
  const id = deps.createId();
  let relativePath = '';
  try {
    relativePath = deps.writePdf(calculationId, id, prepared.bytes);
    const attachment = await deps.addAttachment({
      id,
      calculationId,
      kind: 'pdf',
      fileRelPath: relativePath,
      mime: 'application/pdf',
      sizeBytes: prepared.bytes.byteLength,
      width: null,
      height: null,
    });
    return { ok: true, attachment };
  } catch {
    if (relativePath) deps.removeStored(relativePath);
    return { ok: false, message: attachmentPdfFailureMessage('corrupt') };
  }
}
