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
