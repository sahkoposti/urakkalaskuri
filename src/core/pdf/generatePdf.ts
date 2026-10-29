import { File, Paths } from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

/** A4 pystyssä, 72 PPI (expo-print käyttää pikseleitä). */
export const A4_PORTRAIT = { width: 595, height: 842 } as const;

export type GeneratePdfOptions = {
  html: string;
  /** Lopullinen nimi, esim. buildPdfFileName(...) */
  fileName: string;
  /** Avaa jakovalikon. Oletus true. */
  share?: boolean;
  dialogTitle?: string;
};

export type GeneratePdfResult = {
  uri: string;
  numberOfPages: number;
  shared: boolean;
};

/**
 * html → printToFileAsync → siirto välimuistiin oikealla nimellä → shareAsync.
 * Vanha samanniminen tiedosto korvataan (uusintatuloste).
 */
export async function generatePdf(options: GeneratePdfOptions): Promise<GeneratePdfResult> {
  const printed = await printToFileAsync({
    html: options.html,
    width: A4_PORTRAIT.width,
    height: A4_PORTRAIT.height,
  });

  const target = new File(Paths.cache, options.fileName);
  if (target.exists) target.delete();
  const source = new File(printed.uri);
  source.move(target);

  let shared = false;
  if (options.share !== false) {
    if (!(await isAvailableAsync())) {
      throw new Error('Jakaminen ei ole käytettävissä tällä laitteella');
    }
    await shareAsync(target.uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: options.dialogTitle ?? options.fileName,
    });
    shared = true;
  }

  return { uri: target.uri, numberOfPages: printed.numberOfPages, shared };
}
