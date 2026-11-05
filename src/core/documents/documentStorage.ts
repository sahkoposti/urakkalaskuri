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

export function applyDocumentStorageCleanup(
  plan: { removeFiles: readonly string[]; missingRows: readonly string[] },
  deps: { deleteFile(path: string): void; reportMissing(path: string): void },
): void {
  for (const path of plan.removeFiles) deps.deleteFile(path);
  for (const path of plan.missingRows) deps.reportMissing(path);
}
