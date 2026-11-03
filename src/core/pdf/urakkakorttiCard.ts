import type { CalculationRecord, FormSnapshot } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import { ensureStructureLines } from '@/src/core/structure/legacyCalculation';
import { formatFixed2, roundToCents } from '@/src/core/utils/formatters';
import type { BusinessVatMode } from '@/src/core/utils/priceDisplay';

import { DEFAULT_SIVUKULUKERROIN } from './defaultOfferSettings';
import { effectiveContractVat0 } from './manualContract';

/** Laskelman `form_snapshot`-JSON. Puuttuva avain = alihankkija. */
export const URAKKAKORTTI_MODE_KEY = 'urakkakorttiMode' as const;

/** Laskelman `form_snapshot`-JSON. Puuttuva avain = esitäyttö asiakkaan lisätiedoista. */
export const URAKKAKORTTI_HUOMIO_KEY = 'urakkakorttiHuomioitavaa' as const;

/** Laskelman `form_snapshot`-JSON. Puuttuva avain = alv0. */
export const BUSINESS_VAT_MODE_KEY = 'businessVatMode' as const;

/** Laskelman `form_snapshot`-JSON. Puuttuva avain = hinnat näytetään. */
export const URAKKAKORTTI_HIDE_PRICES_KEY = 'urakkakorttiHidePrices' as const;

/** Laskelman `form_snapshot`-JSON. Puuttuva avain = laskettu urakka. Avain = StructureLine.id. */
export const URAKKAKORTTI_RIVIHINNAT_KEY = 'urakkakorttiRivihinnat' as const;

export type UrakkakorttiMode = 'alihankkija' | 'tyontekija';

export function isUrakkakorttiMode(value: unknown): value is UrakkakorttiMode {
  return value === 'alihankkija' || value === 'tyontekija';
}

function snapshotRecord(snapshot: FormSnapshot | null | undefined): Record<string, unknown> {
  return snapshot && typeof snapshot === 'object' ? (snapshot as unknown as Record<string, unknown>) : {};
}

function hasKey(snapshot: FormSnapshot | null | undefined, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(snapshotRecord(snapshot), key);
}

/**
 * Puuttuva tai tuntematon arvo = alihankkija (nykyinen kortti).
 * Tuntematonta tallennetta ei hylätä, jotta vanha laskelma aukeaa.
 */
export function readUrakkakorttiMode(snapshot: FormSnapshot | null | undefined): UrakkakorttiMode {
  if (!hasKey(snapshot, URAKKAKORTTI_MODE_KEY)) return 'alihankkija';
  const value = snapshotRecord(snapshot)[URAKKAKORTTI_MODE_KEY];
  return isUrakkakorttiMode(value) ? value : 'alihankkija';
}

/** Tuntematon muoto = ei yliajoja. Vain numerot jäävät. */
export function readUrakkakorttiRivihinnat(
  snapshot: FormSnapshot | null | undefined,
): Record<string, number> | undefined {
  if (!hasKey(snapshot, URAKKAKORTTI_RIVIHINNAT_KEY)) return undefined;
  const value = snapshotRecord(snapshot)[URAKKAKORTTI_RIVIHINNAT_KEY];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const prices: Record<string, number> = {};
  for (const [id, amount] of Object.entries(value as Record<string, unknown>)) {
    if (typeof amount === 'number') prices[id] = amount;
  }
  return prices;
}

/**
 * Korvaa koko kartan. Tyhjä kartta poistaa avaimen.
 * Kutsuja yhdistää vanhat ja uudet avaimet; poistettu avain ei jää.
 */
export function calculationWithUrakkakorttiRivihinnat(
  record: CalculationRecord,
  values: Record<string, number>,
): CalculationRecord {
  const clean: Record<string, number> = {};
  for (const [id, amount] of Object.entries(values)) {
    if (typeof amount === 'number') clean[id] = amount;
  }
  const snapshot = record.formSnapshot;
  const has = hasKey(snapshot, URAKKAKORTTI_RIVIHINNAT_KEY);
  if (Object.keys(clean).length === 0) {
    if (!has || !snapshot) return record;
    const next = { ...snapshot };
    delete next.urakkakorttiRivihinnat;
    return { ...record, formSnapshot: next };
  }
  return withSnapshot(record, { urakkakorttiRivihinnat: clean });
}

/**
 * Lomakkeen esitäytön lähde. Alihankkija: kortille tulostuva urakka.
 * Työntekijä: sama summa ennen Sivukulukerroin-jakoa.
 */
export function derivedCardContractAmount(
  line: { contractPriceVat0: number },
  mode: UrakkakorttiMode,
): number {
  return mode === 'tyontekija' ? line.contractPriceVat0 : effectiveContractVat0(line);
}

/** Kentän teksti. Yliajo näytetään, jos se on tallennettu. Muuten laskettu summa. */
export function cardPriceFieldText(
  line: { id: string; contractPriceVat0: number },
  mode: UrakkakorttiMode,
  overrides: Record<string, number> | undefined,
): string {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, line.id)) {
    const amount = overrides[line.id];
    if (typeof amount === 'number' && Number.isFinite(amount)) return formatFixed2(amount);
  }
  const derived = derivedCardContractAmount(line, mode);
  return Number.isFinite(derived) ? formatFixed2(derived) : '';
}

export function cardPriceFieldTexts(
  record: CalculationRecord,
  mode: UrakkakorttiMode = readUrakkakorttiMode(record.formSnapshot),
): Record<string, string> {
  const overrides = readUrakkakorttiRivihinnat(record.formSnapshot);
  const text: Record<string, string> = {};
  for (const line of ensureStructureLines(record)) {
    text[line.id] = cardPriceFieldText(line, mode, overrides);
  }
  return text;
}

/** Pilkku tai piste. Tyhjä = ei yliajoa. Ei-luku = virheellinen. */
export function parseCardPriceInput(raw: string): number | 'empty' | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) return 'empty';
  const n = Number(trimmed.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 'invalid';
}

/**
 * Tallennuskartta. Laskettua summaa tai tyhjää kenttää ei kirjoiteta.
 * Virheellinen teksti säilyttää aiemman yliajon. Paluu laskettuun summaan poistaa avaimen.
 */
export function urakkakorttiRivihinnatFromFieldTexts(
  record: CalculationRecord,
  texts: Record<string, string>,
  mode: UrakkakorttiMode = readUrakkakorttiMode(record.formSnapshot),
): Record<string, number> {
  const stored = readUrakkakorttiRivihinnat(record.formSnapshot) ?? {};
  const next: Record<string, number> = {};
  for (const line of ensureStructureLines(record)) {
    const parsed = parseCardPriceInput(texts[line.id] ?? '');
    if (parsed === 'invalid') {
      if (Object.prototype.hasOwnProperty.call(stored, line.id)) next[line.id] = stored[line.id];
      continue;
    }
    if (parsed === 'empty') continue;
    const derived = derivedCardContractAmount(line, mode);
    if (Number.isFinite(derived) && roundToCents(parsed) === roundToCents(derived)) continue;
    next[line.id] = parsed;
  }
  return next;
}

/** Rivin urakka ennen kerrointa. Yliajo voittaa lasketun hinnan. Orpo avain ei osu mihinkään riviin. */
export function cardContractBase(
  line: { id: string; contractPriceVat0: number },
  mode: UrakkakorttiMode,
  overrides: Record<string, number> | undefined,
): number {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, line.id)) return overrides[line.id];
  return mode === 'tyontekija' ? line.contractPriceVat0 : effectiveContractVat0(line);
}

/** Vain täsmälleen `true` piilottaa hinnat. Puuttuva ja muu arvo = näytä. */
export function readUrakkakorttiHidePrices(snapshot: FormSnapshot | null | undefined): boolean {
  if (!hasKey(snapshot, URAKKAKORTTI_HIDE_PRICES_KEY)) return false;
  return snapshotRecord(snapshot)[URAKKAKORTTI_HIDE_PRICES_KEY] === true;
}

export function urakkakorttiModeLabel(mode: UrakkakorttiMode): string {
  return mode === 'tyontekija' ? 'Urakkakortti: Työntekijä' : 'Urakkakortti: Alihankkija';
}

/**
 * Esitäytön lähde: laskelman `customer`-sarakkeen JSON-avaimen `notes` arvo
 * (`parseCustomerDetails` / `customerFromRecord(record).notes`).
 * Ei formSnapshot-avain eikä yrityksen asetus. Vanha ei-JSON-teksti on kokonaan tämä lähde.
 */
export function customerNotesSource(record: CalculationRecord): string {
  return customerFromRecord(record).notes ?? '';
}

/** null = avain puuttuu (käytä esitäyttöä). Merkkijono = tallennettu teksti, myös tyhjä. */
export function readStoredHuomioitavaa(record: CalculationRecord): string | null {
  const snapshot = record.formSnapshot;
  if (!hasKey(snapshot, URAKKAKORTTI_HUOMIO_KEY)) return null;
  const value = snapshotRecord(snapshot)[URAKKAKORTTI_HUOMIO_KEY];
  return typeof value === 'string' ? value : '';
}

export function huomioitavaaFieldText(record: CalculationRecord): string {
  const stored = readStoredHuomioitavaa(record);
  return stored === null ? customerNotesSource(record) : stored;
}

/** Tulostettava teksti. Pelkkä väli = tyhjä, jolloin osiota ei tulosteta. */
export function effectiveHuomioitavaa(record: CalculationRecord): string {
  const text = huomioitavaaFieldText(record).replace(/\r\n/g, '\n').trim();
  return text.trim() ? text : '';
}

function withSnapshot(record: CalculationRecord, patch: Partial<FormSnapshot>): CalculationRecord {
  const nextSnapshot: FormSnapshot = record.formSnapshot
    ? { ...record.formSnapshot, ...patch }
    : { formId: '', formVersion: 0, fields: [], ...patch };
  return { ...record, formSnapshot: nextSnapshot };
}

/** Alihankkija ilman aiempaa avainta ei kirjoita avainta. */
export function calculationWithUrakkakorttiMode(
  record: CalculationRecord,
  mode: UrakkakorttiMode,
): CalculationRecord {
  if (!isUrakkakorttiMode(mode)) {
    throw new Error('Urakkakortin tyyppi on Alihankkija tai Työntekijä.');
  }
  const snapshot = record.formSnapshot;
  const stored = hasKey(snapshot, URAKKAKORTTI_MODE_KEY) ? readUrakkakorttiMode(snapshot) : undefined;
  if (stored === mode) return record;
  if (stored == null && mode === 'alihankkija') return record;
  if (mode === 'alihankkija' && snapshot) {
    const next = { ...snapshot };
    delete next.urakkakorttiMode;
    return { ...record, formSnapshot: next };
  }
  return withSnapshot(record, { urakkakorttiMode: mode });
}

/**
 * Teksti joka vastaa esitäyttöä poistaa avaimen (puuttuva = esitäyttö).
 * Muu teksti, myös tyhjä, tallennetaan ja voittaa esitäytön uusintatulostuksessa.
 */
export function calculationWithHuomioitavaa(record: CalculationRecord, text: string): CalculationRecord {
  const source = customerNotesSource(record);
  const snapshot = record.formSnapshot;
  const hasStored = hasKey(snapshot, URAKKAKORTTI_HUOMIO_KEY);
  if (text === source) {
    if (!hasStored || !snapshot) return record;
    const next = { ...snapshot };
    delete next.urakkakorttiHuomioitavaa;
    return { ...record, formSnapshot: next };
  }
  if (hasStored && snapshot?.urakkakorttiHuomioitavaa === text) return record;
  return withSnapshot(record, { urakkakorttiHuomioitavaa: text });
}

/** Ainoa paikka Työntekijä-tilan hintaesteen tekstille. */
export function invalidEmployeeContractWarning(lineName: string): string {
  return `Urakkakortin rivillä ${lineName} on virheellinen tai negatiivinen urakkahinta. Korjaa hinta ennen tulostusta.`;
}

/** NaN, Infinity tai negatiivinen. Puuttuva ja tasan 0 eivät ole tätä estettä. */
export function employeeContractPriceInvalid(amount: unknown): boolean {
  return typeof amount === 'number' && (!Number.isFinite(amount) || amount < 0);
}

/**
 * Työntekijä-tilan tulostusesteet. Alihankkija palauttaa tyhjän listan,
 * jotta kortin nykyinen käytös säilyy. Ei muuta laskelmaa.
 */
export function urakkakorttiContractProblems(
  record: CalculationRecord,
  mode: UrakkakorttiMode = readUrakkakorttiMode(record.formSnapshot),
  hidePrices: boolean = readUrakkakorttiHidePrices(record.formSnapshot),
): string[] {
  if (hidePrices) return [];
  const overrides = readUrakkakorttiRivihinnat(record.formSnapshot);
  return ensureStructureLines(record).flatMap((line) => {
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, line.id)) {
      return employeeContractPriceInvalid(overrides[line.id]) ? [invalidEmployeeContractWarning(line.name)] : [];
    }
    if (mode === 'tyontekija' && employeeContractPriceInvalid(line.contractPriceVat0)) {
      return [invalidEmployeeContractWarning(line.name)];
    }
    return [];
  });
}

/** Käsin kysyttävät rivit. Yliajo 0 kysyy; positiivinen yliajo ei. Piilotetut hinnat eivät kysy. */
export function cardLinesNeedingManualContract(record: CalculationRecord): ReturnType<typeof ensureStructureLines> {
  if (readUrakkakorttiHidePrices(record.formSnapshot)) return [];
  const overrides = readUrakkakorttiRivihinnat(record.formSnapshot);
  return ensureStructureLines(record).filter((line) => {
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, line.id)) {
      const value = overrides[line.id];
      return !(typeof value === 'number' && Number.isFinite(value) && value > 0);
    }
    return effectiveContractVat0(line) <= 0;
  });
}

export function assertPrintableEmployeeContracts(record: CalculationRecord): void {
  const problems = urakkakorttiContractProblems(record);
  if (problems.length > 0) throw new Error(problems.join('\n'));
}

/**
 * Työntekijä: rivin urakka jaetaan kertoimella ja pyöristetään senteiksi.
 * Nolla pysyy nollana. Virheellinen tai negatiivinen summa heittää, eikä siitä tule 0,00.
 * Alihankkija palauttaa kelvollisen summan sellaisenaan. Ei-luku palauttaa 0 vain Alihankkijalla.
 * Yhteensä lasketaan pyöristetyistä riveistä, ei jakamalla raakasummaa.
 */
export function employeeContractAmount(
  amount: number,
  mode: UrakkakorttiMode,
  factor: number,
  lineName = '',
): number {
  if (mode === 'tyontekija' && employeeContractPriceInvalid(amount)) {
    throw new Error(invalidEmployeeContractWarning(lineName));
  }
  if (!Number.isFinite(amount)) return 0;
  if (mode !== 'tyontekija') return amount;
  if (amount === 0) return 0;
  const divisor = Number.isFinite(factor) && factor > 1 && factor <= 3 ? factor : DEFAULT_SIVUKULUKERROIN;
  return roundToCents(amount / divisor);
}

/** true kirjoittaa avaimen. false poistaa sen (puuttuva = näytä hinnat). */
export function calculationWithUrakkakorttiHidePrices(
  record: CalculationRecord,
  hide: boolean,
): CalculationRecord {
  const snapshot = record.formSnapshot;
  const has = hasKey(snapshot, URAKKAKORTTI_HIDE_PRICES_KEY);
  if (!hide) {
    if (!has || !snapshot) return record;
    const next = { ...snapshot };
    delete next.urakkakorttiHidePrices;
    return { ...record, formSnapshot: next };
  }
  if (has && snapshot?.urakkakorttiHidePrices === true) return record;
  return withSnapshot(record, { urakkakorttiHidePrices: true });
}

/** ALV 0 poistaa avaimen (puuttuva = alv0). Sis. ALV kirjoittaa `businessVatMode: 'sis'`. */
export function calculationWithBusinessVatMode(
  record: CalculationRecord,
  mode: BusinessVatMode,
): CalculationRecord {
  if (mode !== 'alv0' && mode !== 'sis') {
    throw new Error('Yritystarjouksen ALV on ALV 0 tai sis. ALV.');
  }
  const snapshot = record.formSnapshot;
  const has = hasKey(snapshot, BUSINESS_VAT_MODE_KEY);
  if (mode === 'alv0') {
    if (!has || !snapshot) return record;
    const next = { ...snapshot };
    delete next.businessVatMode;
    return { ...record, formSnapshot: next };
  }
  if (has && snapshot?.businessVatMode === 'sis') return record;
  return withSnapshot(record, { businessVatMode: 'sis' });
}

const SNAPSHOT_EXTRA_KEYS = [
  'ktvPersons',
  URAKKAKORTTI_MODE_KEY,
  URAKKAKORTTI_HUOMIO_KEY,
  BUSINESS_VAT_MODE_KEY,
  URAKKAKORTTI_HIDE_PRICES_KEY,
  URAKKAKORTTI_RIVIHINNAT_KEY,
] as const;

/** Wizardin uudelleenkirjoitus säilyttää laskelman JSON-avaimet. */
export function preserveCalculationSnapshot(
  record: CalculationRecord,
  previous: FormSnapshot | null | undefined,
): CalculationRecord {
  if (!previous) return record;
  const patch: Partial<FormSnapshot> = {};
  let any = false;
  for (const key of SNAPSHOT_EXTRA_KEYS) {
    if (!hasKey(previous, key)) continue;
    (patch as Record<string, unknown>)[key] = snapshotRecord(previous)[key];
    any = true;
  }
  if (!any) return record;
  return withSnapshot(record, patch);
}
