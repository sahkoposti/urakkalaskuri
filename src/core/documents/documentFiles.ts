import { Directory, File, Paths } from 'expo-file-system';

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

export function deleteCalculationDocumentFolder(calculationId: string): void {
  const folder = new Directory(Paths.document, 'documents', calculationId);
  if (folder.exists) folder.delete();
}
