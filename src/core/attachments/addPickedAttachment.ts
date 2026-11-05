import { File } from 'expo-file-system';
import { PDFDocument } from '@cantoo/pdf-lib';

import { createId } from '@/src/core/utils/id';

import { addAttachment, listAttachments } from './attachmentsRepository';
import {
  attachmentFileUri,
  placeAttachmentFile,
  removeStoredAttachment,
  writeAttachmentBytes,
} from './attachmentFiles';
import { manipulateAttachmentImage } from './expoImageManipulator';
import { ingestPickedAttachment, type PickedAttachment } from './ingestAttachment';
import type { Attachment } from './types';

async function pdfPageCount(attachment: Attachment): Promise<number> {
  try {
    const bytes = await new File(attachmentFileUri(attachment.fileRelPath)).bytes();
    const doc = await PDFDocument.load(bytes);
    return doc.getPageCount();
  } catch {
    return 0;
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
    placeImage: (sourceUri, idCalculation, id) => placeAttachmentFile(sourceUri, idCalculation, id, 'jpg'),
    writePdf: (idCalculation, id, bytes) => writeAttachmentBytes(idCalculation, id, 'pdf', bytes),
    addAttachment: (input) => addAttachment({ ...input, destination: 'none' }),
    removeStored: (relativePath) => {
      try {
        removeStoredAttachment(relativePath);
      } catch {
        // Tiedosto voi puuttua, jos kirjoitus ehti epäonnistua.
      }
    },
  });
}
