/**
 * Kotitalousvähennys (KTV) tarjous-PDF:n viimeiselle sivulle (T8, laskentaosa).
 *
 * Eemilin päätökset 29.10.2026: vähennyksen pohja = KOKO hinta jaettuna työhön ja materiaaleihin
 * (työn osuus sis. ALV). Matka-aika ja matkakulut kuuluvat maalarin näkökulmasta työhön, joten ne
 * jäävät työn osuuteen (Eemil 17.14 #4). 5.11.2026: alennus pienentää myös materiaaleja; kutsuja
 * antaa jo alennetut materiaalit sis. ALV. Omavastuu ja enimmäismäärä lasketaan vain niin
 * monelle henkilölle kuin vähennys oikeasti tarvitsee (personsUsed), ei kaikille valituille.
 * Tulos on arvio. Matkakuluista ei tulosteta erillistä varaumaa.
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
  'Vähennyksestä on vähennetty omavastuu ja se on rajattu henkilökohtaiseen vuosittaiseen enimmäismäärään. ' +
  'Materiaalit eivät ole vähennyskelpoisia. Lopullisen vähennyksen määrää Verohallinto.';

export type KotitalousDeductionInput = {
  /** Asiakkaan kokonaishinta sis. ALV alennuksen jälkeen. */
  totalPriceVat: number;
  /** Materiaalit sis. ALV alennuksen jälkeen. Alennusta ei vähennetä tässä uudelleen. */
  materialsVat: number;
  settings: KtvSettings;
  /** Henkilömäärä 1..10. Puuttuva = 1. Kelvoton arvo hylätään. */
  persons?: number;
};

export type KotitalousDeductionResult = {
  workShareVatIncluded: number;
  /** Materiaalit sis. ALV sellaisena kuin kutsuja ne antoi (alennus jo mukana). */
  materialsShareVatIncluded: number;
  /** Prosentti × työn osuus, ennen omavastuuta ja enimmäismäärää. */
  grossDeduction: number;
  /** Arvioitu vähennys omavastuun ja enimmäismäärän jälkeen. */
  deductionAmount: number;
  /** Lomakkeella valittu henkilömäärä n. Puuttuva syöte = 1. */
  persons: number;
  /** Henkilömäärä, jonka omavastuu ja katto antavat suurimman vähennyksen. Tasatilanteessa pienin. */
  personsUsed: number;
  capApplied: boolean;
  estimatedCostAfterDeduction: number;
  settings: KtvSettings;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type KtvPriceSplit = { workShareVatIncluded: number; materialsShareVatIncluded: number };

const finiteNonNegative = (n: number | undefined) => Math.max(0, typeof n === 'number' && Number.isFinite(n) ? n : 0);

/**
 * KTV:n pohja: KOKO hinta jaetaan työhön ja materiaaleihin.
 * Alennus vähennetään materiaaleista ennen kutsua (offerMaterialsVatIncluded, Eemil 5.11.2026).
 * Tämä funktio käyttää annettuja lukuja sellaisenaan eikä vähennä alennusta toista kertaa:
 *   materiaalien osuus = annetut materiaalit sis. ALV
 *   työn osuus         = asiakkaan maksama hinta sis. ALV (alennuksen jälkeen) − materiaalit
 * Jos työn osuus menisi negatiiviseksi, työn osuus = 0.
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

/** Vähennys, jos omavastuu ja katto lasketaan tasan k henkilölle. */
function deductionForPersonCount(gross: number, k: number, deductibleEur: number, capEur: number): number {
  return Math.min(k * capEur, Math.max(0, gross - k * deductibleEur));
}

/**
 * Pienin k väliltä 1..n, joka antaa suurimman vähennyksen.
 * Suurempi k ei auta, jos sen lisäomavastuu syö hyödyn.
 */
function personsNeeded(gross: number, persons: number, deductibleEur: number, capEur: number): number {
  let bestK = 1;
  let best = deductionForPersonCount(gross, 1, deductibleEur, capEur);
  for (let k = 2; k <= persons; k += 1) {
    const amount = deductionForPersonCount(gross, k, deductibleEur, capEur);
    if (amount > best) {
      best = amount;
      bestK = k;
    }
  }
  return bestK;
}

export function kotitalousDeduction(input: KotitalousDeductionInput): KotitalousDeductionResult {
  const settings = normalizeKtvSettings(input.settings);
  const persons = resolvePersons(input.persons);
  const total = Math.max(0, Number.isFinite(input.totalPriceVat) ? input.totalPriceVat : 0);
  const { workShareVatIncluded, materialsShareVatIncluded } = ktvPriceSplit(input.totalPriceVat, input.materialsVat);
  const grossDeduction = round2((workShareVatIncluded * settings.ratePercent) / 100);
  const personsUsed = personsNeeded(grossDeduction, persons, settings.deductibleEur, settings.capEur);
  const deductionAmount = round2(
    deductionForPersonCount(grossDeduction, personsUsed, settings.deductibleEur, settings.capEur),
  );
  const capApplied = grossDeduction - personsUsed * settings.deductibleEur > personsUsed * settings.capEur;
  return {
    workShareVatIncluded,
    materialsShareVatIncluded,
    grossDeduction,
    deductionAmount,
    persons,
    personsUsed,
    capApplied,
    estimatedCostAfterDeduction: round2(total - deductionAmount),
    settings,
  };
}
