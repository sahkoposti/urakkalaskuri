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
}