import { printAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

import { DOCUMENT_SHARE_UNAVAILABLE } from './documentLabels';

/**
 * Android: järjestelmän tulostus- ja esikatseluikkuna tallennetulle PDF:lle.
 * iOS: printAsync({ uri }) on sama kutsu. Laitteella tätä ei ole ajettu.
 */
export async function previewSavedPdf(uri: string): Promise<void> {
  await printAsync({ uri });
}

export async function shareSavedPdf(uri: string, dialogTitle: string): Promise<void> {
  if (!(await isAvailableAsync())) {
    throw new Error(DOCUMENT_SHARE_UNAVAILABLE);
  }
  await shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle,
  });
}
