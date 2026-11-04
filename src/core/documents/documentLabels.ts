import { formatCurrency } from '@/src/core/utils/formatters';

import { fileSystemEntryName } from './documentStorage';
import type { PhonePlatform } from './phoneSave';
import type { DocumentKind, PhoneSaveStatus } from './types';

export const PHONE_STATUS_OK = 'Puhelimessa';
export const PHONE_STATUS_SKIPPED = 'Ei puhelimessa';
export const PHONE_STATUS_FAILED = 'Puhelimeen tallennus epäonnistui';
export const PHONE_SAVE_RETRY = 'Yritä uudelleen';
export const PHONE_SAVE_TO_PHONE = 'Tallenna puhelimeen';
export const PHONE_FOLDER_CHANGE = 'Vaihda';
export const PHONE_FOLDER_CLEAR = 'Tyhjennä';
export const PHONE_FOLDER_EXPLANATION =
  'Valitse tai luo puhelimeen kansio nimeltä Urakkalaskuri. Tarjoukset ja urakkakortit kopioidaan sinne.';

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

export function phoneStatusLabel(status: PhoneSaveStatus): string {
  if (status === 'ok') return PHONE_STATUS_OK;
  if (status === 'failed') return PHONE_STATUS_FAILED;
  return PHONE_STATUS_SKIPPED;
}

/** iOS ei tarjoa puhelinkopiota. Onnistunut rivi ei kaipaa nappia. */
export function phoneSaveActionLabel(status: PhoneSaveStatus, platform: PhonePlatform): string | null {
  if (platform !== 'android' || status === 'ok') return null;
  return status === 'failed' ? PHONE_SAVE_RETRY : PHONE_SAVE_TO_PHONE;
}

export function phoneFolderDisplayName(uri: string | null): string {
  if (!uri?.trim()) return 'ei valittu';
  try {
    return fileSystemEntryName(uri.trim()) || 'valittu';
  } catch {
    return 'valittu';
  }
}

export function phoneFolderRowLabel(uri: string | null): string {
  return `Puhelimen kansio: ${phoneFolderDisplayName(uri)}`;
}
