/**
 * Nimi `file://`-URIsta.
 *
 * expo-file-system 19.0.24: hakemiston uri päättyy aina `/`-merkkiin.
 * Android `FileSystemDirectory.asString` ja `listAsRecords` lisäävät vinoviivan
 * (`FileSystemDirectory.kt`, myös tiedostoille listauksessa).
 * iOS `FileSystemDirectory.validatePath` vaatii `url.hasDirectoryPath`, ja
 * `listAsRecords` käyttää `absoluteString`-arvoa (`FileSystemDirectory.swift`).
 * `Directory.name` käyttää `Paths.basename`-funktiota, joka ohittaa loppuvinoviivan.
 * Pelkkä viimeinen `/` antaa tyhjän nimen.
 */
export function fileSystemEntryName(uri: string): string {
  const decoded = decodeURIComponent(uri).replace(/\/+$/, '');
  const cut = Math.max(decoded.lastIndexOf('/'), decoded.lastIndexOf(':'));
  return decoded.slice(cut + 1);
}

/** `documents/<laskelma>/<tiedosto>.pdf` kahdesta listaus-URIsta. */
export function documentRelativePathFromUris(folderUri: string, fileUri: string): string | null {
  const calculationId = fileSystemEntryName(folderUri);
  const name = fileSystemEntryName(fileUri);
  if (!calculationId || !name.toLowerCase().endsWith('.pdf')) return null;
  return `documents/${calculationId}/${name}`;
}

/**
 * Käynnistyksen siivous.
 * Levyllä oleva tiedosto ilman tietokantariviä poistetaan (orpo).
 * Rivi, jonka tiedosto puuttuu, jätetään paikalleen ja raportoidaan.
 * Riviä ei poisteta hiljaa.
 */
export function planDocumentStorageCleanup(input: {
  storedPaths: readonly string[];
  diskPaths: readonly string[];
}): { removeFiles: string[]; missingRows: string[] } {
  const stored = new Set(input.storedPaths);
  const disk = new Set(input.diskPaths);
  return {
    removeFiles: input.diskPaths.filter((path) => !stored.has(path)),
    missingRows: input.storedPaths.filter((path) => !disk.has(path)),
  };
}

/** Laskelman kansio levyllä, kun laskelmaa ei enää ole tietokannassa. */
export function planOrphanCalculationFolders(input: {
  documentPaths: readonly string[];
  attachmentPaths: readonly string[];
  existingIds: ReadonlySet<string>;
}): { documentIds: string[]; attachmentIds: string[] } {
  const idsFor = (root: 'documents' | 'attachments', paths: readonly string[]) => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const path of paths) {
      const [folder, id] = path.split('/');
      if (folder !== root || !id || input.existingIds.has(id) || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  };
  return {
    documentIds: idsFor('documents', input.documentPaths),
    attachmentIds: idsFor('attachments', input.attachmentPaths),
  };
}

/** Kansioiden poisto on paras yritys. Yhden kansion virhe ei estä muita. */
export function applyOrphanCalculationFolderCleanup(
  plan: { documentIds: readonly string[]; attachmentIds: readonly string[] },
  deps: {
    deleteDocumentFolder(id: string): void;
    deleteAttachmentFolder(id: string): void;
    report(kind: 'documents' | 'attachments', id: string, error: unknown): void;
  },
): void {
  for (const id of plan.documentIds) {
    try {
      deps.deleteDocumentFolder(id);
    } catch (error) {
      deps.report('documents', id, error);
    }
  }
  for (const id of plan.attachmentIds) {
    try {
      deps.deleteAttachmentFolder(id);
    } catch (error) {
      deps.report('attachments', id, error);
    }
  }
}

export function applyDocumentStorageCleanup(
  plan: { removeFiles: readonly string[]; missingRows: readonly string[] },
  deps: { deleteFile(path: string): void; reportMissing(path: string): void },
): void {
  for (const path of plan.removeFiles) deps.deleteFile(path);
  for (const path of plan.missingRows) deps.reportMissing(path);
}
