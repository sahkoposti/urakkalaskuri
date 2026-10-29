/**
 * Tarjous-PDF:n asetukset (v1.3).
 *
 * YRITYSKOHTAISET (`offer_company_settings`): voimassaolo, numerointi, KTV ja
 * Lisätiedot-teksti (tarjouksen Lisätiedot-osio, sellaisenaan).
 * RAKENNEKOHTAISET (`offer_settings:<structureId>`, ei lomakepohjan JSON:ssa):
 * lisäteksti tulostuu sen rakenteen osioon (Muuta). `offerPages` säilyy tallessa;
 * tarjous ei lue sivukytkimiä.
 * Lomakepohjan JSON-muoto ei muutu (kentän `print` on P1).
 */

export interface OfferPageInclusion {
  pageId: string;
  enabled: boolean;
}

/** Kotitalousvähennyksen arvot. Asetuksia, ei kovakoodattuja laskennassa. */
export interface KtvSettings {
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
  ktv: KtvSettings;
  /** Valinnainen KTV-sivun huomautus; tyhjä = oletusteksti. */
  ktvFootnoteText: string;
  /** Lisätiedot-osio kaikille tarjouksille. Tyhjä = osio pois. Tulostetaan sellaisenaan. */
  additionalInfoText: string;
}

/** Rakennekohtaiset tarjousasetukset (settings-avain `offer_settings:<structureId>`). */
export interface OfferStructureSettings {
  /** Rakenteen lisäteksti. Tulostuu tämän rakenteen osioon (Muuta). Tyhjä = ei tekstiä. */
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
