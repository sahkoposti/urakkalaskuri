import { File, Paths } from 'expo-file-system';

import { attachmentPathParts } from './attachmentPaths';
import type { AttachmentPdfDeps } from './prepareAttachmentPrint';
import type { Attachment } from './types';

function attachmentFile(relativePath: string): File {
  return new File(Paths.document, ...attachmentPathParts(relativePath));
}

/**
 * Laitteen tiedostoluku. Kuvia ei pienennetä tässä: imageResizePlan jää L4:n
 * toteuttajan käytettäväksi (expo-image-manipulator).
 */
export function defaultAttachmentPdfDeps(): AttachmentPdfDeps {
  return {
    async loadImageDataUri(attachment: Attachment) {
      try {
        const file = attachmentFile(attachment.fileRelPath);
        if (!file.exists) return null;
        const base64 = await file.base64();
        if (!base64) return null;
        const mime = attachment.mime.trim() || 'image/jpeg';
        return `data:${mime};base64,${base64}`;
      } catch {
        return null;
      }
    },
    async readPdfBytes(attachment: Attachment) {
      try {
        const file = attachmentFile(attachment.fileRelPath);
        if (!file.exists) return null;
        const bytes = await file.bytes();
        return bytes.byteLength > 0 ? bytes : null;
      } catch {
        return null;
      }
    },
    async readOfferPdfBytes(uri: string) {
      try {
        const file = new File(uri);
        if (!file.exists) return null;
        const bytes = await file.bytes();
        return bytes.byteLength > 0 ? bytes : null;
      } catch {
        return null;
      }
    },
    async writeFinalPdf(uri: string, bytes: Uint8Array) {
      new File(uri).write(bytes);
    },
  };
}
