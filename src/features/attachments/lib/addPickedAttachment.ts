import { File } from 'expo-file-system';
import { PDFDocument } from '@cantoo/pdf-lib';

import { createId } from '@/src/core/utils/id';

import { addAttachment, listAttachments } from '../storage/attachmentsRepository';
import {
  attachmentFileUri,
  placeAttachmentFile,
  removeStoredAttachment,
  writeAttachmentBytes,
} from './attachmentFiles';
import { manipulateAttachmentImage } from './expoImageManipulator';
import { ingestPickedAttachment, type PickedAttachment } from './ingestAttachment';
import type { Attachment } from './types';

async function pdfPageCount(attachment: Attachment): Promise<number | null> {
  try {
    const bytes = await new File(attachmentFileUri(attachment.fileRelPath)).bytes();
    const doc = await PDFDocument.load(bytes);
    const count = doc.getPageCount();
    return Number.isFinite(count) ? count : null;
  } catch {
    return null;
  }
}

function deleteTemp(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Valitsimen tai käsittelijän tilapäinen kopio voi olla jo poissa.
  }
}

/** Laitepolku: käsitelty kuva tai salaamaton PDF tallennetaan, alkuperäistä ei. */
export async function addPickedAttachment(
  calculationId: string,
  picked: PickedAttachment,
): Promise<{ ok: true; attachment: Attachment } | { ok: false; message: string }> {
  return ingestPickedAttachment(calculationId, picked, {
    createId,
    listAttachments,
    manipulate: manipulateAttachmentImage,
    fileSize: async (uri) => new File(uri).size ?? 0,
    readBytes: async (uri) => {
      try {
        const bytes = await new File(uri).bytes();
        return bytes.byteLength > 0 ? bytes : null;
      } catch {
        return null;
      }
    },
    pdfPageCount,
    deleteTemp,
    placeImage: (sourceUri, idCalculation, id) => placeAttachmentFile(sourceUri, idCalculation, id, 'jpg'),
    writePdf: (idCalculation, id, bytes) => writeAttachmentBytes(idCalculation, id, 'pdf', bytes),
    addAttachment: (input) => addAttachment(input),
    removeStored: (relativePath) => {
      try {
        removeStoredAttachment(relativePath);
      } catch {
        // Tiedosto voi puuttua, jos kirjoitus ehti epäonnistua.
      }
    },
  });
}
