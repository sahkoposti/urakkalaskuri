import type { CalculationRecord, FormSnapshot } from '@/src/core/models/types';

/** Laskelman `form_snapshot`-JSON. Ei SQL-migraatiota eikä lomakepohjan avainta. */
export const KTV_PERSONS_JSON_KEY = 'ktvPersons' as const;

export const KTV_PERSONS_MIN = 1;
export const KTV_PERSONS_MAX = 10;

export const KTV_PERSONS_INVALID_MESSAGE = 'Henkilöiden määrä on kokonaisluku väliltä 1–10.';

export function isValidKtvPersons(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= KTV_PERSONS_MIN &&
    value <= KTV_PERSONS_MAX
  );
}

function hasPersonsKey(snapshot: FormSnapshot | null | undefined): snapshot is FormSnapshot {
  return !!snapshot && Object.prototype.hasOwnProperty.call(snapshot, KTV_PERSONS_JSON_KEY);
}

/**
 * Tallenteesta. Puuttuva tai null = 1. Läsnä oleva kelvoton arvo hylätään.
 */
export function readKtvPersons(snapshot: FormSnapshot | null | undefined): number {
  if (!hasPersonsKey(snapshot) || snapshot.ktvPersons == null) return 1;
  if (!isValidKtvPersons(snapshot.ktvPersons)) {
    throw new Error(KTV_PERSONS_INVALID_MESSAGE);
  }
  return snapshot.ktvPersons;
}

/** Kentän teksti. Puuttuva avain näyttää oletuksen 1. */
export function ktvPersonsFieldText(snapshot: FormSnapshot | null | undefined): string {
  if (!hasPersonsKey(snapshot) || snapshot.ktvPersons == null) return '1';
  if (typeof snapshot.ktvPersons === 'number' && Number.isFinite(snapshot.ktvPersons)) {
    return String(snapshot.ktvPersons);
  }
  return '';
}

/** Syöte 1..10. Tyhjä, desimaali, 0 ja 11 ovat kelvottomia. */
export function parseKtvPersonsInput(raw: string): number | 'invalid' {
  const trimmed = raw.trim();
  if (!/^(?:[1-9]|10)$/.test(trimmed)) return 'invalid';
  const parsed = Number(trimmed);
  return isValidKtvPersons(parsed) ? parsed : 'invalid';
}

/** Kirjaa n laskelman form_snapshotiin. n = 1 ilman aiempaa avainta ei muuta tietuetta. */
export function calculationWithKtvPersons(record: CalculationRecord, persons: number): CalculationRecord {
  if (!isValidKtvPersons(persons)) throw new Error(KTV_PERSONS_INVALID_MESSAGE);
  const snapshot = record.formSnapshot;
  const stored = hasPersonsKey(snapshot) ? snapshot.ktvPersons : undefined;
  if (stored === persons) return record;
  if (stored == null && persons === KTV_PERSONS_MIN) return record;
  const nextSnapshot: FormSnapshot = snapshot
    ? { ...snapshot, ktvPersons: persons }
    : { formId: '', formVersion: 0, fields: [], ktvPersons: persons };
  return { ...record, formSnapshot: nextSnapshot };
}

/** Wizardin uudelleenkirjoitus ei saa pudottaa avainta. */
export function preserveKtvPersons(
  record: CalculationRecord,
  previous: FormSnapshot | null | undefined,
): CalculationRecord {
  if (!hasPersonsKey(previous)) return record;
  const nextSnapshot: FormSnapshot = record.formSnapshot
    ? { ...record.formSnapshot, ktvPersons: previous.ktvPersons }
    : { formId: '', formVersion: 0, fields: [], ktvPersons: previous.ktvPersons };
  return { ...record, formSnapshot: nextSnapshot };
}
