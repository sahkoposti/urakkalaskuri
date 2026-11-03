import type { CalculationRecord, FormSnapshot } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import { ensureStructureLines } from '@/src/core/structure/legacyCalculation';
import { roundToCents } from '@/src/core/utils/formatters';

import { DEFAULT_SIVUKULUKERROIN } from './defaultOfferSettings';

/** Laskelman `form_snapshot`-JSON. Puuttuva avain = alihankkija. */
export const URAKKAKORTTI_MODE_KEY = 'urakkakorttiMode' as const;

/** Laskelman `form_snapshot`-JSON. Puuttuva avain = esitäyttö asiakkaan lisätiedoista. */
export const URAKKAKORTTI_HUOMIO_KEY = 'urakkakorttiHuomioitavaa' as const;

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
): string[] {
  if (mode !== 'tyontekija') return [];
  return ensureStructureLines(record)
    .filter((line) => employeeContractPriceInvalid(line.contractPriceVat0))
    .map((line) => invalidEmployeeContractWarning(line.name));
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

const SNAPSHOT_EXTRA_KEYS = ['ktvPersons', URAKKAKORTTI_MODE_KEY, URAKKAKORTTI_HUOMIO_KEY] as const;

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
