import { Directory, File, Paths } from 'expo-file-system';

import { attachmentPathParts, attachmentRelativePath, attachmentRelativePathFromUris } from './attachmentPaths';

function attachmentFile(relativePath: string): File {
  return new File(Paths.document, ...attachmentPathParts(relativePath));
}

export function attachmentFileUri(relativePath: string): string {
  return attachmentFile(relativePath).uri;
}

export function writeAttachmentBytes(
  calculationId: string,
  id: string,
  ext: string,
  bytes: Uint8Array,
): string {
  const relativePath = attachmentRelativePath(calculationId, id, ext);
  const parts = attachmentPathParts(relativePath);
  const folder = new Directory(Paths.document, ...parts.slice(0, -1));
  if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
  const target = new File(Paths.document, ...parts);
  if (target.exists) target.delete();
  target.write(bytes);
  return relativePath;
}

export function placeAttachmentFile(
  sourceUri: string,
  calculationId: string,
  id: string,
  ext: string,
): string {
  const relativePath = attachmentRelativePath(calculationId, id, ext);
  const folder = new Directory(Paths.document, 'attachments', calculationId);
  if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
  const name = relativePath.split('/').pop() ?? `${id}.${ext}`;
  const target = new File(folder, name);
  if (target.exists) target.delete();
  new File(sourceUri).copy(target);
  return relativePath;
}

export function copyAttachmentFile(sourceRel: string, targetRel: string): void {
  const source = attachmentFile(sourceRel);
  if (!source.exists) throw new Error('Liitteen tiedosto puuttuu.');
  const parts = attachmentPathParts(targetRel);
  const folder = new Directory(Paths.document, ...parts.slice(0, -1));
  if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
  const target = new File(Paths.document, ...parts);
  if (target.exists) target.delete();
  source.copy(target);
}

export function removeStoredAttachment(relativePath: string): void {
  const file = attachmentFile(relativePath);
  if (file.exists) file.delete();
}

/** Suhteelliset polut `attachments/<laskelma>/<tiedosto>`. */
export function listAttachmentDiskPaths(): string[] {
  const root = new Directory(Paths.document, 'attachments');
  if (!root.exists) return [];
  const paths: string[] = [];
  for (const entry of root.list()) {
    if (typeof (entry as Directory).list !== 'function') continue;
    for (const file of (entry as Directory).list()) {
      const relative = attachmentRelativePathFromUris(entry.uri, file.uri);
      if (relative) paths.push(relative);
    }
  }
  return paths;
}

export function deleteCalculationAttachmentFolder(calculationId: string): void {
  const folder = new Directory(Paths.document, 'attachments', calculationId);
  if (folder.exists) folder.delete();
}
