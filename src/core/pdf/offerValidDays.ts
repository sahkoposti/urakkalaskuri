import type { CalculationRecord, FormSnapshot } from '@/src/core/models/types';

import { DEFAULT_OFFER_VALID_DAYS } from './defaultOfferSettings';

/** Laskelman `form_snapshot`-JSON. Puuttuva avain = yrityksen oletus. */
export const OFFER_VALID_DAYS_KEY = 'offerValidDays' as const;

export const OFFER_VALID_DAYS_MIN = 1;
export const OFFER_VALID_DAYS_MAX = 365;

export const OFFER_VALID_DAYS_INVALID_MESSAGE = 'Tarjous voimassa on kokonaisluku väliltä 1–365.';

export function isValidOfferValidDays(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= OFFER_VALID_DAYS_MIN &&
    value <= OFFER_VALID_DAYS_MAX
  );
}

function hasDaysKey(snapshot: FormSnapshot | null | undefined): snapshot is FormSnapshot {
  return !!snapshot && Object.prototype.hasOwnProperty.call(snapshot, OFFER_VALID_DAYS_KEY);
}

/** Yrityksen asetus, tai 31 jos asetus ei ole kelvollinen. */
export function companyOfferValidDays(value: number | undefined): number {
  return isValidOfferValidDays(value) ? value : DEFAULT_OFFER_VALID_DAYS;
}

/**
 * Tarjouksen voimassaolo. Puuttuva avain = yrityksen oletus.
 * Kelvoton tallennettu arvo ei kaada tulostusta: käytetään yrityksen oletusta.
 */
export function readOfferValidDays(snapshot: FormSnapshot | null | undefined, companyDefault?: number): number {
  const fallback = companyOfferValidDays(companyDefault);
  if (!hasDaysKey(snapshot) || snapshot.offerValidDays == null) return fallback;
  return isValidOfferValidDays(snapshot.offerValidDays) ? snapshot.offerValidDays : fallback;
}

/**
 * Kentän teksti. Tallennettu avain näytetään heti.
 * Puuttuva avain näyttää yrityksen oletuksen vasta kun se on ladattu (`null` = ei vielä).
 */
export function offerValidDaysFieldText(
  snapshot: FormSnapshot | null | undefined,
  companyDefault?: number | null,
): string {
  if (hasDaysKey(snapshot) && snapshot.offerValidDays != null) {
    if (typeof snapshot.offerValidDays === 'number' && Number.isFinite(snapshot.offerValidDays)) {
      return String(snapshot.offerValidDays);
    }
    return '';
  }
  if (companyDefault == null) return '';
  return String(companyOfferValidDays(companyDefault));
}

export type OfferValidDaysSave = number | 'skip' | 'invalid';

/**
 * Koskematon kenttä ilman tallennettua avainta ei kirjoita oletusta päälle.
 * `companyDefault === null` tarkoittaa, että yrityksen asetus ei ole vielä ladattu.
 */
export function offerValidDaysForSave(input: {
  snapshot: FormSnapshot | null | undefined;
  fieldText: string;
  companyDefault: number | null;
  touched: boolean;
}): OfferValidDaysSave {
  const hasStored = hasDaysKey(input.snapshot) && input.snapshot.offerValidDays != null;
  if (!input.touched && !hasStored) return 'skip';
  if (input.companyDefault == null && !input.touched) return 'skip';
  const parsed = parseOfferValidDaysInput(input.fieldText);
  if (parsed === 'invalid') return 'invalid';
  if (parsed === 'empty') {
    if (input.companyDefault == null) return 'skip';
    return input.companyDefault;
  }
  return parsed;
}

/** Syöte 1..365. Tyhjä = paluu oletukseen. Desimaali, 0 ja 366 ovat kelvottomia. */
export function parseOfferValidDaysInput(raw: string): number | 'empty' | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) return 'empty';
  if (!/^\d+$/.test(trimmed)) return 'invalid';
  const parsed = Number(trimmed);
  return isValidOfferValidDays(parsed) ? parsed : 'invalid';
}

function withoutDays(snapshot: FormSnapshot): FormSnapshot {
  const next = { ...snapshot };
  delete next.offerValidDays;
  return next;
}

/**
 * Kirjaa päivien määrän. Oletusta vastaava tai tyhjäksi tulkittu arvo poistaa avaimen.
 */
export function calculationWithOfferValidDays(
  record: CalculationRecord,
  days: number,
  companyDefault?: number,
): CalculationRecord {
  if (!isValidOfferValidDays(days)) throw new Error(OFFER_VALID_DAYS_INVALID_MESSAGE);
  const snapshot = record.formSnapshot;
  const fallback = companyOfferValidDays(companyDefault);
  if (days === fallback) {
    if (!hasDaysKey(snapshot)) return record;
    return { ...record, formSnapshot: withoutDays(snapshot) };
  }
  if (hasDaysKey(snapshot) && snapshot.offerValidDays === days) return record;
  const nextSnapshot: FormSnapshot = snapshot
    ? { ...snapshot, offerValidDays: days }
    : { formId: '', formVersion: 0, fields: [], offerValidDays: days };
  return { ...record, formSnapshot: nextSnapshot };
}
