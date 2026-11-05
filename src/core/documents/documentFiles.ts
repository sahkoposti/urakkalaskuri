import { Directory, File, Paths } from 'expo-file-system';

import { documentRelativePathFromUris } from './documentStorage';

/** Suhteellinen polku Paths.document-juuresta. Tietokantaan tallennetaan tämä. */
export function documentRelativePath(calculationId: string, documentId: string): string {
  return `documents/${calculationId}/${documentId}.pdf`;
}

export function placePrintedPdf(
  tempUri: string,
  calculationId: string,
  documentId: string,
): { uri: string; relativePath: string } {
  const folder = new Directory(Paths.document, 'documents', calculationId);
  if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
  const target = new File(folder, `${documentId}.pdf`);
  if (target.exists) target.delete();
  new File(tempUri).move(target);
  return { uri: target.uri, relativePath: documentRelativePath(calculationId, documentId) };
}

export function storedPdfFile(relativePath: string): File {
  const parts = relativePath.split('/').filter((part) => part.length > 0);
  return new File(Paths.document, ...parts);
}

export function storedPdfUri(relativePath: string): string {
  return storedPdfFile(relativePath).uri;
}

export function removeStoredPdf(relativePath: string): void {
  const file = storedPdfFile(relativePath);
  if (file.exists) file.delete();
}

/** Suhteelliset polut `documents/<laskelma>/<tiedosto>.pdf`. */
export function listDocumentDiskPaths(): string[] {
  const root = new Directory(Paths.document, 'documents');
  if (!root.exists) return [];
  const paths: string[] = [];
  for (const entry of root.list()) {
    if (typeof (entry as Directory).list !== 'function') continue;
    for (const file of (entry as Directory).list()) {
      const relative = documentRelativePathFromUris(entry.uri, file.uri);
      if (relative) paths.push(relative);
    }
  }
  return paths;
}

export function deleteCalculationDocumentFolder(calculationId: string): void {
  const folder = new Directory(Paths.document, 'documents', calculationId);
  if (folder.exists) folder.delete();
}
