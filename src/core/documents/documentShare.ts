import { formatIsoDate } from '@/src/core/pdf/pdfFileName';

import type { DocumentKind } from './types';

/**
 * Jaossa käytettävä nimi. Ei asiakkaan nimeä. Vain ASCII.
 * Tarjous_10285_v2_2026-11-03.pdf / Urakkakortti_v1_2026-11-03.pdf
 */
export function shareDocumentFileName(input: {
  kind: DocumentKind;
  offerNumber: number | null;
  version: number;
  createdAt: Date;
}): string {
  const version = Math.max(1, Math.trunc(Number.isFinite(input.version) ? input.version : 1));
  const date = formatIsoDate(input.createdAt);
  const offerNumber =
    input.kind === 'tarjous' &&
    typeof input.offerNumber === 'number' &&
    Number.isFinite(input.offerNumber) &&
    input.offerNumber > 0
      ? Math.trunc(input.offerNumber)
      : null;
  const parts = [input.kind === 'tarjous' ? 'Tarjous' : 'Urakkakortti'];
  if (offerNumber != null) parts.push(String(offerNumber));
  parts.push(`v${version}`, date);
  return `${parts.join('_')}.pdf`;
}

/**
 * Kopioi uuid-tiedoston välimuistiin luettavalla nimellä, jakaa sen ja poistaa kopion.
 * Tallennettu tiedosto jää ennalleen.
 */
export async function shareStoredPdf(input: {
  storedUri: string;
  shareName: string;
  copyToCache: (storedUri: string, shareName: string) => Promise<string>;
  share: (uri: string, dialogTitle: string) => Promise<void>;
  removeTemp: (uri: string) => void;
}): Promise<void> {
  const tempUri = await input.copyToCache(input.storedUri, input.shareName);
  try {
    await input.share(tempUri, input.shareName);
  } finally {
    input.removeTemp(tempUri);
  }
}
