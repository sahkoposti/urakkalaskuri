import { File, Paths } from 'expo-file-system';

import { attachmentPathParts } from './attachmentPaths';
import { attachmentImageNeedsProcessing, processAttachmentImage } from './processAttachmentImage';
import type { AttachmentPdfDeps } from './prepareAttachmentPrint';
import type { Attachment } from './types';

function attachmentFile(relativePath: string): File {
  return new File(Paths.document, ...attachmentPathParts(relativePath));
}

/**
 * Laitteen tiedostoluku. Lisäyshetkellä käsitelty JPEG luetaan sellaisenaan.
 * Muuten kuva kirjoitetaan uudeksi JPEG:ksi (expo-image-manipulator).
 */
export function defaultAttachmentPdfDeps(): AttachmentPdfDeps {
  return {
    async loadImageDataUri(attachment: Attachment) {
      try {
        const file = attachmentFile(attachment.fileRelPath);
        if (!file.exists) return null;
        if (!attachmentImageNeedsProcessing(attachment.width, attachment.height, attachment.mime)) {
          const base64 = await file.base64();
          if (!base64) return null;
          const mime = attachment.mime.trim() || 'image/jpeg';
          return `data:${mime};base64,${base64}`;
        }
        const { manipulateAttachmentImage } = await import('./expoImageManipulator');
        const processed = await processAttachmentImage(
          { uri: file.uri, width: attachment.width, height: attachment.height },
          manipulateAttachmentImage,
        );
        if (!processed.ok) return null;
        const base64 = await new File(processed.uri).base64();
        if (!base64) return null;
        return `data:image/jpeg;base64,${base64}`;
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
