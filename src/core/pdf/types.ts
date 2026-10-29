/**
 * Tarjous-PDF:n asetukset (v1.3, T4).
 *
 * Eemilin päätökset 29.10.2026:
 * - YRITYSKOHTAISET (yksi settings-avain): voimassaolo, numeroinnin aloitus, KHV-%, omavastuu, enimmäismäärä.
 * - RAKENNEKOHTAISET (paikallisesti puhelimessa, EI lomakepohjan JSON:ssa): Lisätiedot-teksti ja tulostettavat sivut.
 *   Monirakenteisessa laskelmassa käytetään ENSIMMÄISEN valitun rakenteen Lisätiedot-tekstiä.
 * Lomakepohjan (FormDefinition) JSON-muoto ei muutu.
 */

export interface OfferPageInclusion {
  pageId: string;
  enabled: boolean;
}

/** Kotitalousvähennyksen arvot. Asetuksia, ei kovakoodattuja laskennassa. */
export interface KhvSettings {
  /** Vähennysprosentti työn osuudesta sis. ALV. */
  ratePercent: number;
  /** Omavastuu euroina / henkilö / vuosi. */
  deductibleEur: number;
  /** Enimmäismäärä euroina / henkilö / vuosi. */
  capEur: number;
}

/** Yrityskohtaiset tarjousasetukset (settings-avain `offer_company_settings`). */
export interface OfferCompanySettings {
  /** Voimassaolo kalenteripäivinä; PDF:ssä päättymispäivä. */
  offerValidDays: number;
  /** Juoksevan tarjousnumeron aloitus. */
  offerNumberStart: number;
  khv: KhvSettings;
  /** Valinnainen KHV-sivun huomautus; tyhjä = oletusteksti. */
  khvFootnoteText: string;
}

/** Rakennekohtaiset tarjousasetukset (settings-avain `offer_settings:<structureId>`). */
export interface OfferStructureSettings {
  /** Lisätiedot-osion teksti; tyhjä = osio pois. */
  additionalInfoText: string;
  offerPages: OfferPageInclusion[];
}

/** UI:n / PDF:n käyttämä synkronoitu sivurivi (otsikko aina lomakkeelta). */
export interface SyncedOfferPage extends OfferPageInclusion {
  title: string;
  /** Oletusarvo säännön mukaan (näytetään UI:ssa vihjeenä). */
  defaultEnabled: boolean;
}

export const OFFER_COMPANY_SETTINGS_KEY = 'offer_company_settings';
export const OFFER_STRUCTURE_SETTINGS_KEY_PREFIX = 'offer_settings:';

export function offerStructureSettingsKey(structureId: string): string {
  return `${OFFER_STRUCTURE_SETTINGS_KEY_PREFIX}${structureId}`;
}
