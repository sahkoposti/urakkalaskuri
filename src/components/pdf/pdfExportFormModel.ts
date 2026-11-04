import type { CalculationRecord, CustomerInfo } from '@/src/core/models/types';
import {
  calculationWithHuomioitavaa,
  calculationWithUrakkakorttiHidePrices,
  calculationWithUrakkakorttiMode,
  calculationWithUrakkakorttiRivihinnat,
  invalidEmployeeContractWarning,
  parseCardPriceInput,
  urakkakorttiRivihinnatFromFieldTexts,
  type UrakkakorttiMode,
} from '@/src/core/pdf/urakkakorttiCard';
import { isPrivateCustomer } from '@/src/core/utils/priceDisplay';

/** Laskelman tiedot -näkymän paikallinen välilehti. Ei reittiä. */
export type DetailTab = 'laskelma' | 'dokumentit';

export const DETAIL_TABS: readonly { id: DetailTab; label: string }[] = [
  { id: 'laskelma', label: 'Laskelma' },
  { id: 'dokumentit', label: 'Dokumentit' },
];

export const DOKUMENTTI_ACTIONS = [
  { id: 'tarjous', label: 'Luo tarjous' },
  { id: 'urakkakortti', label: 'Luo urakkakortti' },
] as const;

export type DokumenttiKind = (typeof DOKUMENTTI_ACTIONS)[number]['id'];

/**
 * Tarjouslomakkeen `form_snapshot`-avaimet (viimeksi käytetty).
 * Henkilömäärä tallennetaan vain, kun kenttä on käytössä.
 */
export const TARJOUS_SNAPSHOT_KEYS = ['ktvPersons', 'ktvPageIncluded', 'offerValidDays', 'businessVatMode'] as const;

/** Urakkakorttilomakkeen `form_snapshot`-avaimet (viimeksi käytetty). */
export const URAKKAKORTTI_SNAPSHOT_KEYS = [
  'urakkakorttiMode',
  'urakkakorttiHuomioitavaa',
  'urakkakorttiHidePrices',
  'urakkakorttiRivihinnat',
] as const;

/**
 * Tarjouksen kentät. Kotitalousvähennyksen henkilömäärä vain yksityisasiakkaalle.
 * Yrityksen ALV-valinta vain, kun kyseessä on yritys eikä käänteinen ALV.
 */
export function offerFormFields(
  customer: CustomerInfo,
  ktvPageIncluded = true,
): {
  showKtvPageChoice: boolean;
  showKtvPersons: boolean;
  showBusinessVatChoice: boolean;
} {
  const showKtvPageChoice = isPrivateCustomer(customer) && !customer.reverseVat;
  return {
    showKtvPageChoice,
    showKtvPersons: showKtvPageChoice && ktvPageIncluded,
    showBusinessVatChoice: (customer.customerType ?? 'private') === 'business' && !customer.reverseVat,
  };
}

export function validDaysHint(companyValidDays: number | null): string {
  return companyValidDays == null
    ? 'Esitäyttö yrityksen asetuksesta.'
    : `Esitäyttö yrityksen asetuksesta (${companyValidDays} päivää).`;
}

/** Samat esteet kuin aiemmin Luo tarjous -painikkeella. Ei muuta laskelmaa. */
export function tarjousBlockingMessages(input: {
  offerProblems: readonly string[];
  personsProblem: string | null;
  validDaysProblem: string | null;
  expiryDateProblem: string | null;
}): string[] {
  return [
    ...input.offerProblems,
    ...(input.personsProblem ? [input.personsProblem] : []),
    ...(input.validDaysProblem ? [input.validDaysProblem] : []),
    ...(input.expiryDateProblem ? [input.expiryDateProblem] : []),
  ];
}

/**
 * Luo tarjous on pois käytöstä, kun luonti on kesken, yrityksen voimassaolo
 * ei ole vielä latautunut, tai lomakkeella on estävä viesti.
 */
export function tarjousCreateDisabled(input: {
  busy: boolean;
  companyValidDaysLoaded: boolean;
  blockingMessages: readonly string[];
}): boolean {
  return input.busy || !input.companyValidDaysLoaded || input.blockingMessages.length > 0;
}

/** Luo urakkakortti on pois käytöstä, kun luonti on kesken tai korteilla on este. */
export function urakkakorttiCreateDisabled(input: {
  busy: boolean;
  cardProblems: readonly string[];
}): boolean {
  return input.busy || input.cardProblems.length > 0;
}

/** Rivihinnat piilotetaan, kun urakkahintoja ei näytetä. */
export function showCardRowPrices(hidePrices: boolean): boolean {
  return !hidePrices;
}

/**
 * Kesken oleva rivihinnan teksti. Sama sääntö kuin aiemmin painikkeiden yläpuolella:
 * piilotetut hinnat eivät estä, kelvoton teksti estää rivin nimellä.
 */
export function draftCardPriceProblems(
  lines: readonly { id: string; name: string }[],
  overrideText: Readonly<Record<string, string>>,
  hidePrices: boolean,
): string[] {
  if (hidePrices) return [];
  return lines.flatMap((line) =>
    parseCardPriceInput(overrideText[line.id] ?? '') === 'invalid'
      ? [invalidEmployeeContractWarning(line.name)]
      : [],
  );
}

export function dokumenttiCreateTitle(kind: DokumenttiKind, busy: boolean): string {
  if (kind === 'tarjous') return busy ? 'Luodaan tarjousta…' : 'Luo tarjous';
  return busy ? 'Luodaan urakkakorttia…' : 'Luo urakkakortti';
}

/** Lomakkeen näkyvä luonnos. Kytkimet tulevat tallenteesta, teksti voi olla kesken. */
export type PdfFormDraft = {
  personsText: string;
  validDaysText: string;
  validDateText: string;
  huomioText: string;
  rowPriceText: Record<string, string>;
  cardMode: 'alihankkija' | 'tyontekija';
  businessVatMode: 'alv0' | 'sis';
  hidePrices: boolean;
  ktvPageIncluded: boolean;
};

/** Kenttä, jota ei ole vielä blurattu tallenteeseen. */
export type PdfFormDirty = {
  personsText: boolean;
  validDays: boolean;
  huomioText: boolean;
  rowPriceText: boolean;
};

/** `snapshot` = tallennus lomakkeesta tai ulkoa. `reopen` ja `calculation` hylkäävät luonnosten. */
export type PdfFormSyncReason = 'snapshot' | 'reopen' | 'calculation';

export function cleanPdfFormDirty(): PdfFormDirty {
  return { personsText: false, validDays: false, huomioText: false, rowPriceText: false };
}

/** Uusi laskelma nollaa. Sama id ja muuttunut snapshot ei. */
export function pdfFormSyncReason(
  previousCalculationId: string | null,
  calculationId: string,
): PdfFormSyncReason {
  return previousCalculationId !== calculationId ? 'calculation' : 'snapshot';
}

function copyPdfFormDraft(draft: PdfFormDraft): PdfFormDraft {
  return { ...draft, rowPriceText: { ...draft.rowPriceText } };
}

/**
 * KTV-kytkin ja muut lomakkeen tallennukset päivittävät snapshotin.
 * Likainen kenttä jää. Puhdas kenttä seuraa tallennetta.
 * Pohjalevyn avaus ja laskelman vaihto hakevat kaiken tallenteesta.
 */
export function syncPdfFormDraft(
  current: PdfFormDraft,
  saved: PdfFormDraft,
  dirty: PdfFormDirty,
  reason: PdfFormSyncReason,
): { draft: PdfFormDraft; dirty: PdfFormDirty } {
  if (reason === 'reopen' || reason === 'calculation') {
    return { draft: copyPdfFormDraft(saved), dirty: cleanPdfFormDirty() };
  }
  return {
    draft: {
      personsText: dirty.personsText ? current.personsText : saved.personsText,
      validDaysText: dirty.validDays ? current.validDaysText : saved.validDaysText,
      validDateText: dirty.validDays ? current.validDateText : saved.validDateText,
      huomioText: dirty.huomioText ? current.huomioText : saved.huomioText,
      rowPriceText: dirty.rowPriceText ? { ...current.rowPriceText } : { ...saved.rowPriceText },
      cardMode: saved.cardMode,
      businessVatMode: saved.businessVatMode,
      hidePrices: saved.hidePrices,
      ktvPageIncluded: saved.ktvPageIncluded,
    },
    dirty: { ...dirty },
  };
}

/**
 * Luo urakkakortti käyttää kesken olevat kentät. Puhdas kenttä jää
 * tallennetuksi. Rivihinta kirjoitetaan vain, jos käyttäjä on muuttanut sitä.
 */
export function calculationForUrakkakorttiCreate(
  record: CalculationRecord,
  input: {
    mode: UrakkakorttiMode;
    hidePrices: boolean;
    dirtyHuomio: boolean;
    dirtyRowPrices: boolean;
    typedHuomio: string;
    typedRowPrices: Record<string, string>;
  },
): CalculationRecord {
  let next = calculationWithUrakkakorttiMode(record, input.mode);
  next = calculationWithUrakkakorttiHidePrices(next, input.hidePrices);
  if (input.dirtyHuomio) next = calculationWithHuomioitavaa(next, input.typedHuomio);
  if (input.dirtyRowPrices) {
    next = calculationWithUrakkakorttiRivihinnat(
      next,
      urakkakorttiRivihinnatFromFieldTexts(next, input.typedRowPrices, input.mode),
    );
  }
  return next;
}

/** Likaisuus poistuu vasta, kun tietueen tallennus on onnistunut. */
export function dirtyAfterUrakkakorttiSave(dirty: PdfFormDirty, saved: boolean): PdfFormDirty {
  if (!saved) return { ...dirty };
  return { ...dirty, huomioText: false, rowPriceText: false };
}
