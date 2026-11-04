import type { CalculationRecord, FormSnapshot } from '@/src/core/models/types';

/**
 * Laskelman `form_snapshot`-JSON. Ei lomakepohjan avain eikä SQL-migraatio.
 * Puuttuva avain = KTV-sivu mukana (nykyinen tarjous). Vain `false` jättää sivun pois.
 */
export const KTV_PAGE_INCLUDED_KEY = 'ktvPageIncluded' as const;

function hasIncludedKey(snapshot: FormSnapshot | null | undefined): snapshot is FormSnapshot {
  return !!snapshot && Object.prototype.hasOwnProperty.call(snapshot, KTV_PAGE_INCLUDED_KEY);
}

/** Puuttuva avain ja muu kuin täsmälleen `false` = sivu mukana. */
export function readKtvPageIncluded(snapshot: FormSnapshot | null | undefined): boolean {
  if (!hasIncludedKey(snapshot)) return true;
  return snapshot.ktvPageIncluded !== false;
}

/**
 * `true` poistaa avaimen (puuttuva = mukana). `false` kirjoittaa avaimen.
 * Sama tietue palautetaan, jos tallenne ei muutu.
 */
export function calculationWithKtvPageIncluded(record: CalculationRecord, included: boolean): CalculationRecord {
  const snapshot = record.formSnapshot;
  const has = hasIncludedKey(snapshot);
  if (included) {
    if (!has) return record;
    const next = { ...snapshot };
    delete next.ktvPageIncluded;
    return { ...record, formSnapshot: next };
  }
  if (has && snapshot.ktvPageIncluded === false) return record;
  const nextSnapshot: FormSnapshot = snapshot
    ? { ...snapshot, ktvPageIncluded: false }
    : { formId: '', formVersion: 0, fields: [], ktvPageIncluded: false };
  return { ...record, formSnapshot: nextSnapshot };
}
