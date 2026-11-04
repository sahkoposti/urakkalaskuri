import { formatIsoDate } from '@/src/core/pdf/pdfFileName';

import type { DocumentKind } from './types';

/** Jakokopio saa elää näin kauan. Seuraava käynnistys poistaa vanhemmat. */
export const SHARE_COPY_MAX_AGE_MS = 30 * 60 * 1000;

function formatLocalHm(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}${minutes}`;
}

/**
 * Jaossa käytettävä nimi. Ei asiakkaan nimeä. Vain ASCII.
 * Kellonaika erottaa saman päivän dokumentit.
 * Tarjous_10285_v2_2026-11-03_1405.pdf / Urakkakortti_v1_2026-11-03_1405.pdf
 */
export function shareDocumentFileName(input: {
  kind: DocumentKind;
  offerNumber: number | null;
  version: number;
  createdAt: Date;
}): string {
  const version = Math.max(1, Math.trunc(Number.isFinite(input.version) ? input.version : 1));
  const date = formatIsoDate(input.createdAt);
  const time = formatLocalHm(input.createdAt);
  const offerNumber =
    input.kind === 'tarjous' &&
    typeof input.offerNumber === 'number' &&
    Number.isFinite(input.offerNumber) &&
    input.offerNumber > 0
      ? Math.trunc(input.offerNumber)
      : null;
  const parts = [input.kind === 'tarjous' ? 'Tarjous' : 'Urakkakortti'];
  if (offerNumber != null) parts.push(String(offerNumber));
  parts.push(`v${version}`, `${date}_${time}`);
  return `${parts.join('_')}.pdf`;
}

/**
 * Kopioi uuid-tiedoston välimuistiin luettavalla nimellä ja jakaa kopion.
 * Onnistunut jako jättää kopion. Androidin shareAsync palaa, kun valitsin
 * sulkeutuu, ja vastaanottaja voi lukea tiedoston myöhemmin.
 * Epäonnistunut jako poistaa kopion heti. Tallennettu tiedosto jää ennalleen.
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
  } catch (error) {
    input.removeTemp(tempUri);
    throw error;
  }
}

/** Vain kynnystä vanhemmat jakokopiot. Tuntematon aika jätetään. */
export function shareCopyUrisToDelete(
  files: readonly { uri: string; modifiedAtMs: number | null }[],
  nowMs: number,
  maxAgeMs: number = SHARE_COPY_MAX_AGE_MS,
): string[] {
  return files
    .filter(
      (file) => file.modifiedAtMs != null && nowMs - file.modifiedAtMs > maxAgeMs,
    )
    .map((file) => file.uri);
}
