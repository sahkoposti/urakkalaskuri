import { Directory, File, Paths } from 'expo-file-system';
import { printAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

import { DOCUMENT_SHARE_UNAVAILABLE } from './documentLabels';
import { shareStoredPdf } from './documentShare';

/**
 * Android: järjestelmän tulostus- ja esikatseluikkuna tallennetulle PDF:lle.
 * iOS: printAsync({ uri }) on sama kutsu. Laitteella tätä ei ole ajettu.
 */
export async function previewSavedPdf(uri: string): Promise<void> {
  await printAsync({ uri });
}

function copyStoredPdfToCache(storedUri: string, shareName: string): string {
  const folder = new Directory(Paths.cache, 'document-share');
  if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
  const target = new File(folder, shareName);
  if (target.exists) target.delete();
  new File(storedUri).copy(target);
  return target.uri;
}

/** Jakaa välimuistikopion luettavalla nimellä. Tallennettu uuid-tiedosto jää. */
export async function shareSavedPdf(storedUri: string, shareName: string): Promise<void> {
  await shareStoredPdf({
    storedUri,
    shareName,
    copyToCache: async (uri, name) => copyStoredPdfToCache(uri, name),
    share: async (uri, dialogTitle) => {
      if (!(await isAvailableAsync())) throw new Error(DOCUMENT_SHARE_UNAVAILABLE);
      await shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle,
      });
    },
    removeTemp: (uri) => {
      const file = new File(uri);
      if (file.exists) file.delete();
    },
  });
}
