import { deleteCalculationAttachmentFolder, listAttachmentDiskPaths, removeStoredAttachment } from '@/src/core/attachments/attachmentFiles';
import { listAttachmentFilePaths } from '@/src/core/attachments/attachmentsRepository';
import { getDb } from '@/src/core/database/connection';

import { deleteExpiredShareCopies } from './documentActions';
import { deleteCalculationDocumentFolder, listDocumentDiskPaths, removeStoredPdf } from './documentFiles';
import { listDocumentFilePaths } from './documentsRepository';
import {
  applyDocumentStorageCleanup,
  applyOrphanCalculationFolderCleanup,
  planDocumentStorageCleanup,
  planOrphanCalculationFolders,
} from './documentStorage';

/** Orvot tiedostot pois. Puuttuvaa tiedostoa vastaavaa riviä ei poisteta. */
export async function cleanupDocumentsOnStartup(): Promise<void> {
  deleteExpiredShareCopies();
  const documentDisk = listDocumentDiskPaths();
  const attachmentDisk = listAttachmentDiskPaths();
  const plan = planDocumentStorageCleanup({
    storedPaths: await listDocumentFilePaths(),
    diskPaths: documentDisk,
  });
  applyDocumentStorageCleanup(plan, {
    deleteFile: removeStoredPdf,
    reportMissing: (path) => {
      console.warn(`Dokumentin tiedosto puuttuu, riviä ei poistettu: ${path}`);
    },
  });
  const attachments = planDocumentStorageCleanup({
    storedPaths: await listAttachmentFilePaths(),
    diskPaths: attachmentDisk,
  });
  applyDocumentStorageCleanup(attachments, {
    deleteFile: removeStoredAttachment,
    reportMissing: (path) => {
      console.warn(`Liitteen tiedosto puuttuu, riviä ei poistettu: ${path}`);
    },
  });
  await cleanupOrphanCalculationFolders(documentDisk, attachmentDisk);
}

/** Kansio, jonka laskelmaa ei enää ole. Epäonnistunut poisto ei kaada käynnistystä. */
export async function cleanupOrphanCalculationFolders(
  documentPaths: readonly string[],
  attachmentPaths: readonly string[],
): Promise<void> {
  let existingIds: Set<string>;
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM calculations');
    existingIds = new Set(rows.map((row) => String(row.id)));
  } catch (error) {
    console.warn('Laskelmien tunnuksia ei voitu lukea, kansioita ei siivota', error);
    return;
  }
  applyOrphanCalculationFolderCleanup(
    planOrphanCalculationFolders({ documentPaths, attachmentPaths, existingIds }),
    {
      deleteDocumentFolder: deleteCalculationDocumentFolder,
      deleteAttachmentFolder: deleteCalculationAttachmentFolder,
      report: (kind, id, error) => {
        console.warn(kind === 'documents' ? 'Dokumenttikansion siivous epäonnistui' : 'Liitekansion siivous epäonnistui', id, error);
      },
    },
  );
}