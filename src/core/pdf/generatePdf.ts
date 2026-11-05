import { printToFileAsync } from 'expo-print';

import { placePrintedPdf } from '@/src/core/documents/documentFiles';

/** A4 pystyssä, 72 PPI (expo-print käyttää pikseleitä). */
export const A4_PORTRAIT = { width: 595, height: 842 } as const;

export type GeneratePdfOptions = {
  html: string;
  fileName: string;
  calculationId: string;
  documentId: string;
};

export type GeneratePdfResult = {
  uri: string;
  relativePath: string;
  numberOfPages: number;
  fileName: string;
};

/**
 * html → printToFileAsync → siirto Paths.document/documents/<laskelma>/<id>.pdf.
 * Jako ei käynnisty tästä. HTML pysyy kutsujan antamana.
 */
export async function generatePdf(options: GeneratePdfOptions): Promise<GeneratePdfResult> {
  const printed = await printToFileAsync({
    html: options.html,
    width: A4_PORTRAIT.width,
    height: A4_PORTRAIT.height,
  });
  const placed = placePrintedPdf(printed.uri, options.calculationId, options.documentId);
  return {
    uri: placed.uri,
    relativePath: placed.relativePath,
    numberOfPages: printed.numberOfPages,
    fileName: options.fileName,
  };
}
