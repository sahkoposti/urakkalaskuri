import { listAttachmentFilePaths } from '@/src/core/attachments/attachmentsRepository';
import { listAttachmentDiskPaths, removeStoredAttachment } from '@/src/core/attachments/attachmentFiles';

import { deleteExpiredShareCopies } from './documentActions';
import { listDocumentFilePaths } from './documentsRepository';
import { listDocumentDiskPaths, removeStoredPdf } from './documentFiles';
import { applyDocumentStorageCleanup, planDocumentStorageCleanup } from './documentStorage';

/** Orvot tiedostot pois. Puuttuvaa tiedostoa vastaavaa riviä ei poisteta. */
export async function cleanupDocumentsOnStartup(): Promise<void> {
  deleteExpiredShareCopies();
  const plan = planDocumentStorageCleanup({
    storedPaths: await listDocumentFilePaths(),
    diskPaths: listDocumentDiskPaths(),
  });
  applyDocumentStorageCleanup(plan, {
    deleteFile: removeStoredPdf,
    reportMissing: (path) => {
      console.warn(`Dokumentin tiedosto puuttuu, riviä ei poistettu: ${path}`);
    },
  });
  const attachments = planDocumentStorageCleanup({
    storedPaths: await listAttachmentFilePaths(),
    diskPaths: listAttachmentDiskPaths(),
  });
  applyDocumentStorageCleanup(attachments, {
    deleteFile: removeStoredAttachment,
    reportMissing: (path) => {
      console.warn(`Liitteen tiedosto puuttuu, riviä ei poistettu: ${path}`);
    },
  });
}