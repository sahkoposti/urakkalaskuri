/**
 * Kotitalousvähennys (KHV) tarjous-PDF:n viimeiselle sivulle (T8, laskentaosa).
 *
 * Eemilin päätökset 29.10.2026: vähennyksen pohja = KOKO hinta jaettuna työhön ja materiaaleihin
 * (työn osuus sis. ALV). Matka-aika ja matkakulut kuuluvat maalarin näkökulmasta työhön, joten ne
 * jäävät työn osuuteen (Eemil 17.14 #4). Omavastuu ja enimmäismäärä huomioidaan. Tulos on ARVIO yhdelle henkilölle.
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
  'ja se on rajattu henkilökohtaiseen vuosittaiseen enimmäismäärään. Materiaalit eivät ole ' +
  'vähennyskelpoisia. Lopullisen vähennyksen määrää Verohallinto.';

export type KotitalousDeductionInput = {
  /** Asiakkaan kokonaishinta sis. ALV alennuksen jälkeen. */
  totalPriceVat: number;
  /** Kokonaishinta sis. ALV ennen alennusta. Puuttuu → ei alennusta. */
  totalPriceVatBeforeDiscount?: number;
  /** Materiaalit sis. ALV ennen alennusta (laskelman materiaalisumma). */
  materialsVat: number;
  settings: KhvSettings;
};

export type KotitalousDeductionResult = {
  workShareVatIncluded: number;
  /** Materiaalien osuus kokonaishinnasta (alennus kohdistettu), sis. ALV. */
  materialsShareVatIncluded: number;
  /** Prosentti × työn osuus, ennen omavastuuta ja enimmäismäärää. */
  grossDeduction: number;
  /** Arvioitu vähennys omavastuun ja enimmäismäärän jälkeen (yksi henkilö). */
  deductionAmount: number;
  capApplied: boolean;
  estimatedCostAfterDeduction: number;
  settings: KhvSettings;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type KhvPriceSplit = { workShareVatIncluded: number; materialsShareVatIncluded: number };

const finiteNonNegative = (n: number | undefined) => Math.max(0, typeof n === 'number' && Number.isFinite(n) ? n : 0);

/**
 * KHV:n pohja: KOKO hinta jaetaan työhön ja materiaaleihin. AINOA paikka, jossa jako ja alennus lasketaan.
 *
 * Alennuksen käsittely (Eemil 29.10.2026 #4, "koko hinnan jako"): alennus kohdistuu koko hintaan,
 * eli työhön ja materiaaleihin SAMASSA SUHTEESSA kuin ennen alennusta:
 *   kerroin            = hinta alennuksen jälkeen / hinta ennen alennusta
 *   materiaalien osuus = materiaalit (ennen alennusta) × kerroin   (enintään koko hinta)
 *   työn osuus         = hinta alennuksen jälkeen − materiaalien osuus
 * Työn osuus + materiaalien osuus = asiakkaan maksama kokonaishinta. Matka-aika/-kulut ovat työtä.
 * Ilman alennusta (tai jos ennen-hinta puuttuu) kerroin = 1.
 */
export function khvPriceSplit(
  totalPriceVatAfterDiscount: number,
  materialsVat: number,
  totalPriceVatBeforeDiscount?: number,
): KhvPriceSplit {
  const total = finiteNonNegative(totalPriceVatAfterDiscount);
  const before = finiteNonNegative(totalPriceVatBeforeDiscount);
  const factor = before > total && before > 0 ? total / before : 1;
  const materialsShare = round2(Math.min(total, finiteNonNegative(materialsVat) * factor));
  return { workShareVatIncluded: round2(Math.max(0, total - materialsShare)), materialsShareVatIncluded: materialsShare };
}

/** Työn osuus sis. ALV (ks. khvPriceSplit). */
export function khvWorkShareVatIncluded(
  totalPriceVatAfterDiscount: number,
  materialsVat: number,
  totalPriceVatBeforeDiscount?: number,
): number {
  return khvPriceSplit(totalPriceVatAfterDiscount, materialsVat, totalPriceVatBeforeDiscount).workShareVatIncluded;
}

export function kotitalousDeduction(input: KotitalousDeductionInput): KotitalousDeductionResult {
  const settings = normalizeKhvSettings(input.settings);
  const total = Math.max(0, Number.isFinite(input.totalPriceVat) ? input.totalPriceVat : 0);
  const { workShareVatIncluded, materialsShareVatIncluded } = khvPriceSplit(
    input.totalPriceVat,
    input.materialsVat,
    input.totalPriceVatBeforeDiscount,
  );
  const grossDeduction = round2((workShareVatIncluded * settings.ratePercent) / 100);
  const afterDeductible = Math.max(0, grossDeduction - settings.deductibleEur);
  const capApplied = afterDeductible > settings.capEur;
  const deductionAmount = round2(capApplied ? settings.capEur : afterDeductible);
  return {
    workShareVatIncluded,
    materialsShareVatIncluded,
    grossDeduction,
    deductionAmount,
    capApplied,
    estimatedCostAfterDeduction: round2(total - deductionAmount),
    settings,
  };
}
