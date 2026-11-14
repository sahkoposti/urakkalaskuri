import {
  deleteCalculationAttachmentFolder,
  listAttachmentDiskPaths,
  listAttachmentFilePaths,
  removeStoredAttachment,
} from '@/src/features/attachments';
import { getDb } from '@/src/core/database/connection';

import { isSafeCalculationFolderId, UNSAFE_CALCULATION_FOLDER_ID_WARNING } from './calculationFolderId';
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

export const EMPTY_CALCULATION_TABLE_WARNING = 'Laskelmia ei ole, kansioita ei siivota';

/**
 * Tyhjä `calculations`-taulu on palautettu tai uudelleen luotu tietokanta.
 * Silloin ei palauteta poistettavia kansioita, jotta levyn kansiot säilyvät.
 */
export function startupOrphanFolderPlan(
  existingIds: ReadonlySet<string>,
  documentPaths: readonly string[],
  attachmentPaths: readonly string[],
): { documentIds: string[]; attachmentIds: string[] } | null {
  if (existingIds.size === 0) return null;
  return planOrphanCalculationFolders({ documentPaths, attachmentPaths, existingIds });
}

function safeCalculationFolderIds(ids: readonly string[]): string[] {
  const safe: string[] = [];
  for (const id of ids) {
    if (isSafeCalculationFolderId(id)) {
      safe.push(id);
      continue;
    }
    console.warn(UNSAFE_CALCULATION_FOLDER_ID_WARNING, id);
  }
  return safe;
}

type OrphanFolderCleanupDeps = {
  readCalculationIds(): Promise<readonly string[]>;
  deleteDocumentFolder(id: string): void;
  deleteAttachmentFolder(id: string): void;
};

async function readCalculationIdsFromDb(): Promise<readonly string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM calculations');
  return rows.map((row) => String(row.id));
}

/**
 * Kansio, jonka laskelmaa ei enää ole.
 * Tyhjä `calculations`-taulu ei poista kansioita: varoitus ja paluu ilman poistoa.
 * Tietokannan lukemisen epäonnistuminen ei poista kansioita eikä heitä.
 * Virheellistä kansion nimeä ei poisteta. Yhden kansion poiston epäonnistuminen
 * ei estä muita eikä kaada käynnistystä.
 */
export async function cleanupOrphanCalculationFolders(
  documentPaths: readonly string[],
  attachmentPaths: readonly string[],
  deps: OrphanFolderCleanupDeps = {
    readCalculationIds: readCalculationIdsFromDb,
    deleteDocumentFolder: deleteCalculationDocumentFolder,
    deleteAttachmentFolder: deleteCalculationAttachmentFolder,
  },
): Promise<void> {
  let existingIds: Set<string>;
  try {
    existingIds = new Set(await deps.readCalculationIds());
  } catch (error) {
    console.warn('Laskelmien tunnuksia ei voitu lukea, kansioita ei siivota', error);
    return;
  }
  const plan = startupOrphanFolderPlan(existingIds, documentPaths, attachmentPaths);
  if (plan == null) {
    console.warn(EMPTY_CALCULATION_TABLE_WARNING);
    return;
  }
  const safePlan = {
    documentIds: safeCalculationFolderIds(plan.documentIds),
    attachmentIds: safeCalculationFolderIds(plan.attachmentIds),
  };
  applyOrphanCalculationFolderCleanup(safePlan, {
    deleteDocumentFolder: deps.deleteDocumentFolder,
    deleteAttachmentFolder: deps.deleteAttachmentFolder,
    report: (kind, id, error) => {
      console.warn(kind === 'documents' ? 'Dokumenttikansion siivous epäonnistui' : 'Liitekansion siivous epäonnistui', id, error);
    },
  });
}