import { fileSystemEntryName } from '@/src/core/documents/documentStorage';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

export function extensionForMime(mime: string, sourceName?: string): string {
  const known = EXT_BY_MIME[mime.trim().toLowerCase()];
  if (known) return known;
  const fromName = sourceName?.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  return mime.toLowerCase().includes('pdf') ? 'pdf' : 'bin';
}

export function extensionOfRelativePath(relativePath: string): string {
  const name = relativePath.split('/').pop() ?? '';
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return 'bin';
  return name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
}

function safeSegment(value: string): string {
  const cleaned = value.replace(/[\\/]/g, '').trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new Error('Liitteen tunniste puuttuu.');
  }
  return cleaned;
}

/** `attachments/<laskelma>/<id>.<ext>`. Tietokantaan tallennetaan tämä. */
export function attachmentRelativePath(calculationId: string, id: string, ext: string): string {
  const cleanExt = ext.replace(/^\./, '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  return `attachments/${safeSegment(calculationId)}/${safeSegment(id)}.${cleanExt}`;
}

export function attachmentPathParts(relativePath: string): string[] {
  const parts = relativePath.split('/').filter((part) => part.length > 0);
  if (parts[0] !== 'attachments' || parts.some((part) => part === '..' || part === '.')) {
    throw new Error('Virheellinen liitteen polku.');
  }
  return parts;
}

/** `attachments/<laskelma>/<tiedosto>` kahdesta listaus-URIsta. */
export function attachmentRelativePathFromUris(folderUri: string, fileUri: string): string | null {
  const calculationId = fileSystemEntryName(folderUri);
  const name = fileSystemEntryName(fileUri);
  if (!calculationId || !name.includes('.')) return null;
  return `attachments/${calculationId}/${name}`;
}
