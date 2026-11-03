/**
 * Kotitalousvähennys (KTV) tarjous-PDF:n viimeiselle sivulle (T8, laskentaosa).
 *
 * Eemilin päätökset 29.10.2026: vähennyksen pohja = KOKO hinta jaettuna työhön ja materiaaleihin
 * (työn osuus sis. ALV). Matka-aika ja matkakulut kuuluvat maalarin näkökulmasta työhön, joten ne
 * jäävät työn osuuteen (Eemil 17.14 #4). Omavastuu ja enimmäismäärä huomioidaan henkilömäärällä n
 * (oletus 1). Tulos on arvio. Matkakuluista ei tulosteta erillistä varaumaa.
 *
 * Prosentti, omavastuu ja enimmäismäärä ovat YRITYSKOHTAISIA ASETUKSIA (eivät kovakoodattuja):
 * alla olevat arvot ovat vain oletuksia, joita käytetään kun asetusta ei ole tallennettu.
 * Oletukset tarkistettu vero.fi:stä 29.10.2026: 40 % työn arvonlisäverollisesta hinnasta,
 * omavastuu 150 €/hlö/v, enintään 2 100 €/hlö/v. Voimassa vuosina 2026–2027 (väliaikainen laki).
 */
import { DEFAULT_KTV_SETTINGS, normalizeKtvSettings } from './defaultOfferSettings';
import { isValidKtvPersons, KTV_PERSONS_INVALID_MESSAGE } from './ktvPersons';
import type { KtvSettings } from './types';

// Yksi lähde: tyyppi, oletukset ja normalisointi ovat T4:n tarjousasetuksissa (yrityskohtainen asetusavain).
export { DEFAULT_KTV_SETTINGS, normalizeKtvSettings };
export type { KtvSettings };

/** PDF:ään tuleva huomautus (oletus; Tarjous-asetusten oma teksti korvaa). */
export const KTV_DEFAULT_NOTE =
  'Kotitalousvähennys on arvio yhdelle henkilölle. Vähennyksestä on vähennetty omavastuu ' +
  'ja se on rajattu henkilökohtaiseen vuosittaiseen enimmäismäärään. Materiaalit eivät ole ' +
  'vähennyskelpoisia. Lopullisen vähennyksen määrää Verohallinto.';

export type KotitalousDeductionInput = {
  /** Asiakkaan kokonaishinta sis. ALV alennuksen jälkeen. */
  totalPriceVat: number;
  /** Materiaalit sis. ALV sellaisenaan (alennus ei pienennä, ks. ktvPriceSplit). */
  materialsVat: number;
  settings: KtvSettings;
  /** Henkilömäärä 1..10. Puuttuva = 1. Kelvoton arvo hylätään. */
  persons?: number;
};

export type KotitalousDeductionResult = {
  workShareVatIncluded: number;
  /** Materiaalit sis. ALV sellaisenaan (alennus ei kohdistu materiaaleihin). */
  materialsShareVatIncluded: number;
  /** Prosentti × työn osuus, ennen omavastuuta ja enimmäismäärää. */
  grossDeduction: number;
  /** Arvioitu vähennys omavastuun ja enimmäismäärän jälkeen. */
  deductionAmount: number;
  /** Käytetty henkilömäärä. Puuttuva syöte = 1. */
  persons: number;
  capApplied: boolean;
  estimatedCostAfterDeduction: number;
  settings: KtvSettings;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type KtvPriceSplit = { workShareVatIncluded: number; materialsShareVatIncluded: number };

const finiteNonNegative = (n: number | undefined) => Math.max(0, typeof n === 'number' && Number.isFinite(n) ? n : 0);

/**
 * KTV:n pohja: KOKO hinta jaetaan työhön ja materiaaleihin. AINOA paikka, jossa jako ja alennus lasketaan.
 *
 * Alennuksen käsittely (Eemil 29.10.2026 klo 17.33): alennus EI pienennä materiaaleja, se pienentää
 * vain työn osuutta:
 *   materiaalien osuus = materiaalit sis. ALV sellaisenaan (laskelman materiaalisumma, ei alennusta)
 *   työn osuus         = asiakkaan maksama hinta sis. ALV (alennuksen jälkeen) − materiaalit
 * Jos alennus on niin suuri, että työn osuus menisi negatiiviseksi, työn osuus = 0 (rajaus).
 * Matka-aika ja matkakulut kuuluvat työn osuuteen (niitä ei makseta työntekijälle matkakuluina).
 */
export function ktvPriceSplit(totalPriceVatAfterDiscount: number, materialsVat: number): KtvPriceSplit {
  const total = finiteNonNegative(totalPriceVatAfterDiscount);
  const materials = round2(finiteNonNegative(materialsVat));
  return { workShareVatIncluded: round2(Math.max(0, total - materials)), materialsShareVatIncluded: materials };
}

/** Työn osuus sis. ALV (ks. ktvPriceSplit). */
export function ktvWorkShareVatIncluded(totalPriceVatAfterDiscount: number, materialsVat: number): number {
  return ktvPriceSplit(totalPriceVatAfterDiscount, materialsVat).workShareVatIncluded;
}

function resolvePersons(persons: number | undefined): number {
  if (persons === undefined) return 1;
  if (!isValidKtvPersons(persons)) throw new Error(KTV_PERSONS_INVALID_MESSAGE);
  return persons;
}

export function kotitalousDeduction(input: KotitalousDeductionInput): KotitalousDeductionResult {
  const settings = normalizeKtvSettings(input.settings);
  const persons = resolvePersons(input.persons);
  const total = Math.max(0, Number.isFinite(input.totalPriceVat) ? input.totalPriceVat : 0);
  const { workShareVatIncluded, materialsShareVatIncluded } = ktvPriceSplit(input.totalPriceVat, input.materialsVat);
  const grossDeduction = round2((workShareVatIncluded * settings.ratePercent) / 100);
  const deductible = persons * settings.deductibleEur;
  const cap = persons * settings.capEur;
  const afterDeductible = Math.max(0, grossDeduction - deductible);
  const capApplied = afterDeductible > cap;
  const deductionAmount = round2(Math.min(cap, afterDeductible));
  return {
    workShareVatIncluded,
    materialsShareVatIncluded,
    grossDeduction,
    deductionAmount,
    persons,
    capApplied,
    estimatedCostAfterDeduction: round2(total - deductionAmount),
    settings,
  };
}
