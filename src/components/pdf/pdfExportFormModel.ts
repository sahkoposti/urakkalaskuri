import type { CustomerInfo } from '@/src/core/models/types';
import {
  invalidEmployeeContractWarning,
  parseCardPriceInput,
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
export const TARJOUS_SNAPSHOT_KEYS = ['ktvPersons', 'offerValidDays', 'businessVatMode'] as const;

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
export function offerFormFields(customer: CustomerInfo): {
  showKtvPersons: boolean;
  showBusinessVatChoice: boolean;
} {
  return {
    showKtvPersons: isPrivateCustomer(customer),
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
}): string[] {
  return [
    ...input.offerProblems,
    ...(input.personsProblem ? [input.personsProblem] : []),
    ...(input.validDaysProblem ? [input.validDaysProblem] : []),
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
