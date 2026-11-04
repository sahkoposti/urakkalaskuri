import { parseOfferValidDaysInput } from './offerValidDays';
import { formatFinnishDate, validUntil } from './validUntil';

export const OFFER_EXPIRY_DATE_INVALID_MESSAGE =
  'Voimassa asti on päivämäärä muodossa p.k.vvvv, 1–365 päivää tarjouksen päiväyksestä. Mennyttä päivää ei voi valita.';

/** Kalenteripäivien erotus. Kesäaika ei siirrä lukua, koska vertailu on päiväyksissä. */
export function calendarDaysBetween(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / 86_400_000);
}

function realCalendarDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/**
 * Päiväys samaksi päivämääräksi kuin `offerValidDays`.
 * Kelvoton muoto, olematon päivä, mennyt päivä ja 0 tai yli 365 päivää hylätään.
 */
export function parseOfferValidDateInput(raw: string, offerDate: Date): number | 'invalid' {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw.trim());
  if (!match) return 'invalid';
  const date = realCalendarDate(Number(match[3]), Number(match[2]), Number(match[1]));
  if (!date) return 'invalid';
  const days = calendarDaysBetween(offerDate, date);
  return parseOfferValidDaysInput(String(days)) === days ? days : 'invalid';
}

/** Kelvollinen päivämäärä päivittää päiväluvun. Keskeneräinen teksti jättää päiväluvun ennalleen. */
export function daysTextForExpiryDate(dateText: string, offerDate: Date, currentDaysText: string): string {
  const days = parseOfferValidDateInput(dateText, offerDate);
  return typeof days === 'number' ? String(days) : currentDaysText;
}

/** Kelvollinen päiväluku päivittää päiväyksen (tarjouksen päiväys + päivät). */
export function expiryDateTextForDays(daysText: string, offerDate: Date, currentDateText: string): string {
  const parsed = parseOfferValidDaysInput(daysText);
  if (typeof parsed !== 'number') return currentDateText;
  return formatFinnishDate(validUntil(offerDate, parsed));
}

/**
 * Tyhjä päiväys ennen kuin päiväluku on ladattu ei ole virhe.
 * Muuten kelvoton tai päiväluvusta eriävä päiväys estää luonnin.
 */
export function offerExpiryDateProblem(dateText: string, offerDate: Date, daysText: string): string | null {
  const daysParsed = parseOfferValidDaysInput(daysText);
  if (!dateText.trim() && typeof daysParsed !== 'number') return null;
  const fromDate = parseOfferValidDateInput(dateText, offerDate);
  if (fromDate === 'invalid') return OFFER_EXPIRY_DATE_INVALID_MESSAGE;
  if (typeof daysParsed === 'number' && fromDate !== daysParsed) return OFFER_EXPIRY_DATE_INVALID_MESSAGE;
  return null;
}
