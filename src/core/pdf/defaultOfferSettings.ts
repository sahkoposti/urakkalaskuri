import type { KtvSettings, OfferCompanySettings, OfferPageInclusion, OfferStructureSettings } from './types';

/** Oletusvoimassaolo (suunnitelma §4). */
export const DEFAULT_OFFER_VALID_DAYS = 31;
/** Tarjousnumeroinnin aloitus (Eemil 29.10.2026). */
export const DEFAULT_OFFER_NUMBER_START = 10285;

/**
 * KTV-oletukset, tarkistettu vero.fi:stä 29.10.2026: 40 % työn arvonlisäverollisesta hinnasta,
 * omavastuu 150 €/hlö/v, enintään 2 100 €/hlö/v. Voimassa 2026–2027 (väliaikainen laki).
 * Käytetään vain, kun asetusta ei ole tallennettu. Laskenta lukee arvot aina asetuksista.
 */
export const DEFAULT_KTV_SETTINGS: Readonly<KtvSettings> = Object.freeze({
  ratePercent: 40,
  deductibleEur: 150,
  capEur: 2100,
});

export const defaultOfferCompanySettings: Readonly<OfferCompanySettings> = Object.freeze({
  offerValidDays: DEFAULT_OFFER_VALID_DAYS,
  offerNumberStart: DEFAULT_OFFER_NUMBER_START,
  ktv: DEFAULT_KTV_SETTINGS,
  ktvFootnoteText: '',
  additionalInfoText: '',
});

function toNumber(value: unknown): number | undefined {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value.trim().replace(',', '.')) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

function nonNegative(value: unknown, fallback: number): number {
  const n = toNumber(value);
  return n !== undefined && n >= 0 ? n : fallback;
}

function positiveInteger(value: unknown, fallback: number): number {
  const n = toNumber(value);
  return n !== undefined && n >= 1 && Number.isInteger(n) ? n : fallback;
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/** Yhdistää tallennetut (osittaiset tai rikkinäiset) KTV-arvot oletuksiin. Prosentti 0–100. */
export function normalizeKtvSettings(raw: unknown): KtvSettings {
  const src = asRecord(raw);
  const rate = nonNegative(src.ratePercent, DEFAULT_KTV_SETTINGS.ratePercent);
  return {
    ratePercent: rate > 100 ? DEFAULT_KTV_SETTINGS.ratePercent : rate,
    deductibleEur: nonNegative(src.deductibleEur, DEFAULT_KTV_SETTINGS.deductibleEur),
    capEur: nonNegative(src.capEur, DEFAULT_KTV_SETTINGS.capEur),
  };
}

export function normalizeOfferCompanySettings(raw: unknown): OfferCompanySettings {
  const src = asRecord(raw);
  return {
    offerValidDays: (() => {
      const n = toNumber(src.offerValidDays);
      return n !== undefined && n >= 0 && Number.isInteger(n) ? n : DEFAULT_OFFER_VALID_DAYS;
    })(),
    offerNumberStart: positiveInteger(src.offerNumberStart, DEFAULT_OFFER_NUMBER_START),
    ktv: normalizeKtvSettings(src.ktv),
    ktvFootnoteText: typeof src.ktvFootnoteText === 'string' ? src.ktvFootnoteText : '',
    additionalInfoText: typeof src.additionalInfoText === 'string' ? src.additionalInfoText : '',
  };
}

export function parseStoredOfferCompanySettings(value: string | null | undefined): OfferCompanySettings {
  if (!value) return normalizeOfferCompanySettings(undefined);
  try {
    return normalizeOfferCompanySettings(JSON.parse(value));
  } catch {
    return normalizeOfferCompanySettings(undefined);
  }
}

export const defaultOfferStructureSettings: Readonly<OfferStructureSettings> = Object.freeze({
  additionalInfoText: '',
  offerPages: [],
});

export function normalizeOfferStructureSettings(raw: unknown): OfferStructureSettings {
  const src = asRecord(raw);
  const pages: OfferPageInclusion[] = [];
  const seen = new Set<string>();
  if (Array.isArray(src.offerPages)) {
    for (const item of src.offerPages) {
      const rec = asRecord(item);
      if (typeof rec.pageId !== 'string' || rec.pageId === '' || seen.has(rec.pageId)) continue;
      if (typeof rec.enabled !== 'boolean') continue;
      seen.add(rec.pageId);
      pages.push({ pageId: rec.pageId, enabled: rec.enabled });
    }
  }
  return {
    additionalInfoText: typeof src.additionalInfoText === 'string' ? src.additionalInfoText : '',
    offerPages: pages,
  };
}

export function parseStoredOfferStructureSettings(value: string | null | undefined): OfferStructureSettings {
  if (!value) return normalizeOfferStructureSettings(undefined);
  try {
    return normalizeOfferStructureSettings(JSON.parse(value));
  } catch {
    return normalizeOfferStructureSettings(undefined);
  }
}
