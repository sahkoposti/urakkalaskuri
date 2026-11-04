import { formatCurrency } from '@/src/core/utils/formatters';

import type { DocumentKind } from './types';

export const DOCUMENT_SAVED_IN_APP = 'Tallennettu sovellukseen: Dokumentit';
export const DOCUMENT_EMPTY_LIST = 'Ei tallennettuja dokumentteja.';
export const DOCUMENT_PREVIEW_FAILED = 'Esikatselu epäonnistui. Voit jakaa tiedoston Jaa-painikkeella.';
export const DOCUMENT_SHARE_UNAVAILABLE = 'Jakaminen ei ole käytettävissä tällä laitteella.';
export const DOCUMENT_DELETE_TITLE = 'Poistetaanko dokumentti?';

/** Paikallinen aika, esim. 3.11.2026 16.40. */
export function formatDocumentCreatedAt(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()} ${hours}.${minutes}`;
}

export function documentReadyTitle(kind: DocumentKind): string {
  return kind === 'tarjous' ? 'Tarjous valmis' : 'Urakkakortti valmis';
}

export function documentPageCountLabel(pages: number): string {
  const count = Number.isFinite(pages) ? Math.max(0, Math.trunc(pages)) : 0;
  return count === 1 ? '1 sivu' : `${count} sivua`;
}

export function documentListLabel(input: {
  kind: DocumentKind;
  offerNumber: number | null;
  version: number;
  createdAt: Date;
  total: number | null;
}): string {
  const title =
    input.kind === 'tarjous'
      ? `Tarjous${typeof input.offerNumber === 'number' ? ` ${input.offerNumber}` : ''}`
      : 'Urakkakortti';
  const price = input.total == null ? '' : ` · ${formatCurrency(input.total)}`;
  return `${title} · v${input.version} · ${formatDocumentCreatedAt(input.createdAt)}${price}`;
}
