/**
 * PDF-tiedostonimet (suunnitelma §10):
 *   Tarjous_1042_Mäkinen_2026-09-09.pdf
 *   Urakkakortti_Mäkinen_2026-09-09.pdf
 * Suomalaiset kirjaimet säilyvät; tiedostojärjestelmälle vaaralliset merkit poistetaan.
 */
export type PdfKind = 'Tarjous' | 'Urakkakortti';

export type PdfFileNameInput = {
  kind: PdfKind;
  customerName?: string | null;
  date: Date;
  /** Vain tarjoukselle. Urakkakortti ei koskaan saa numeroa. */
  offerNumber?: number | null;
};

const MAX_NAME_LENGTH = 60;

/** Paikallinen päivä muodossa YYYY-MM-DD. */
export function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Siistii nimen tiedostonimeen sopivaksi. Kirjaimet (myös ä, ö, å), numerot ja '-' säilyvät. */
export function sanitizeFileNamePart(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/[^\p{L}\p{N}\-\s]/gu, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, MAX_NAME_LENGTH)
    .replace(/[-_]+$/g, '');
}

export function buildPdfFileName(input: PdfFileNameInput): string {
  const parts: string[] = [input.kind];
  if (
    input.kind === 'Tarjous' &&
    typeof input.offerNumber === 'number' &&
    Number.isFinite(input.offerNumber) &&
    input.offerNumber > 0
  ) {
    parts.push(String(Math.trunc(input.offerNumber)));
  }
  const name = sanitizeFileNamePart(input.customerName);
  if (name) parts.push(name);
  parts.push(formatIsoDate(input.date));
  return `${parts.join('_')}.pdf`;
}
