import { generatePdf } from './generatePdf';
import { loadPdfLogoDataUri } from './logoDataUri';
import { buildPdfFileName } from './pdfFileName';
import { buildPdfSpikeHtml } from './pdfSpikeHtml';

/**
 * T1-spike (väliaikainen, poistetaan T10:ssä): tulostaa 3-sivuisen testi-PDF:n.
 * Vaihe 1 renderöi ja lukee sivumäärän (numberOfPages), vaihe 2 renderöi uudelleen
 * staattisella "Sivu n/m" -varatekstillä ja avaa jakovalikon. Laitteella verrataan,
 * vastaako CSS `counter(pages)` staattista arvoa.
 */
export async function runPdfSpike(now: Date = new Date()): Promise<{ uri: string; numberOfPages: number }> {
  const logoDataUri = await loadPdfLogoDataUri();
  const fileName = buildPdfFileName({ kind: 'Tarjous', customerName: 'PDF-testi', date: now });
  const first = await generatePdf({ html: buildPdfSpikeHtml({ logoDataUri }), fileName, share: false });
  const second = await generatePdf({
    html: buildPdfSpikeHtml({ logoDataUri, knownTotalPages: first.numberOfPages }),
    fileName,
    dialogTitle: 'PDF-testi',
  });
  return { uri: second.uri, numberOfPages: second.numberOfPages };
}
