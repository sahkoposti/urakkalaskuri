/**
 * Kotitalousvähennys (KHV) tarjous-PDF:n viimeiselle sivulle (T8, laskentaosa).
 *
 * Eemilin päätös 29.10.2026: vähennyksen pohja = kokonaishinta sis. ALV − materiaalit sis. ALV
 * (asiakkaan työn osuus sis. ALV). Omavastuu ja enimmäismäärä huomioidaan. Tulos on ARVIO yhdelle henkilölle.
 *
 * Prosentti, omavastuu ja enimmäismäärä ovat YRITYSKOHTAISIA ASETUKSIA (eivät kovakoodattuja):
 * alla olevat arvot ovat vain oletuksia, joita käytetään kun asetusta ei ole tallennettu.
 * Oletukset tarkistettu vero.fi:stä 29.10.2026: 40 % työn arvonlisäverollisesta hinnasta,
 * omavastuu 150 €/hlö/v, enintään 2 100 €/hlö/v. Voimassa vuosina 2026–2027 (väliaikainen laki).
 */
import { DEFAULT_KHV_SETTINGS, normalizeKhvSettings } from './defaultOfferSettings';
import type { KhvSettings } from './types';

// Yksi lähde: tyyppi, oletukset ja normalisointi ovat T4:n tarjousasetuksissa (yrityskohtainen asetusavain).
export { DEFAULT_KHV_SETTINGS, normalizeKhvSettings };
export type { KhvSettings };

/** PDF:ään tuleva huomautus (oletus; Tarjous-asetusten oma teksti korvaa). */
export const KHV_DEFAULT_NOTE =
  'Kotitalousvähennys on arvio yhdelle henkilölle. Vähennyksestä on vähennetty omavastuu ' +
  'ja se on rajattu henkilökohtaiseen vuosittaiseen enimmäismäärään. Materiaalit ja matkakulut ' +
  'eivät ole vähennyskelpoisia. Lopullisen vähennyksen määrää Verohallinto.';

export type KotitalousDeductionInput = {
  /** Asiakkaan kokonaishinta sis. ALV alennuksen jälkeen. */
  totalPriceVat: number;
  /** Materiaalit sis. ALV sellaisenaan (ei erillistä alennusvähennystä, ks. khvWorkShareVatIncluded). */
  materialsVat: number;
  settings: KhvSettings;
};

export type KotitalousDeductionResult = {
  workShareVatIncluded: number;
  /** Prosentti × työn osuus, ennen omavastuuta ja enimmäismäärää. */
  grossDeduction: number;
  /** Arvioitu vähennys omavastuun ja enimmäismäärän jälkeen (yksi henkilö). */
  deductionAmount: number;
  capApplied: boolean;
  estimatedCostAfterDeduction: number;
  settings: KhvSettings;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * KHV:n pohja (työn osuus sis. ALV). AINOA paikka, jossa pohja lasketaan.
 * Väliaikainen sääntö (CTO 29.10.2026), kunnes Eemil päättää alennuksen ja materiaalien suhteen:
 * kokonaishinta sis. ALV ALENNUKSEN JÄLKEEN − materiaalit sis. ALV sellaisenaan
 * (materiaaleihin ei kohdisteta erillistä alennusvähennystä).
 */
export function khvWorkShareVatIncluded(totalPriceVatAfterDiscount: number, materialsVat: number): number {
  const total = Math.max(0, Number.isFinite(totalPriceVatAfterDiscount) ? totalPriceVatAfterDiscount : 0);
  const materials = Math.max(0, Number.isFinite(materialsVat) ? materialsVat : 0);
  return round2(Math.max(0, total - materials));
}

export function kotitalousDeduction(input: KotitalousDeductionInput): KotitalousDeductionResult {
  const settings = normalizeKhvSettings(input.settings);
  const total = Math.max(0, Number.isFinite(input.totalPriceVat) ? input.totalPriceVat : 0);
  const workShareVatIncluded = khvWorkShareVatIncluded(input.totalPriceVat, input.materialsVat);
  const grossDeduction = round2((workShareVatIncluded * settings.ratePercent) / 100);
  const afterDeductible = Math.max(0, grossDeduction - settings.deductibleEur);
  const capApplied = afterDeductible > settings.capEur;
  const deductionAmount = round2(capApplied ? settings.capEur : afterDeductible);
  return {
    workShareVatIncluded,
    grossDeduction,
    deductionAmount,
    capApplied,
    estimatedCostAfterDeduction: round2(total - deductionAmount),
    settings,
  };
}
