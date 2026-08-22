import type { FormDefinition } from '@/src/core/form/types';
import type { CalculationRecord, FormSnapshot } from '@/src/core/models/types';

/** Kasvattaa lomakepohjan versionumeroa tallennuksen yhteydessä. */
export function bumpFormVersion(form: FormDefinition): FormDefinition {
  const current =
    typeof form.version === 'number' && Number.isFinite(form.version) ? form.version : 0;
  return {
    ...form,
    version: current + 1,
  };
}

/** Snapshotin versio eroaa nykyisestä lomakepohjasta. */
export function hasFormVersionMismatch(
  snapshotVersion: number | undefined | null,
  currentVersion: number,
): boolean {
  if (snapshotVersion == null || !Number.isFinite(snapshotVersion)) return false;
  return snapshotVersion !== currentVersion;
}

export function formVersionMismatchFromRecord(
  record: Pick<CalculationRecord, 'formSnapshot'> | null | undefined,
  currentForm: Pick<FormDefinition, 'version'>,
): boolean {
  return hasFormVersionMismatch(record?.formSnapshot?.formVersion, currentForm.version);
}

export function formVersionMismatchFromSnapshot(
  snapshot: FormSnapshot | undefined | null,
  currentForm: Pick<FormDefinition, 'version'>,
): boolean {
  return hasFormVersionMismatch(snapshot?.formVersion, currentForm.version);
}

/** Suomenkielinen varoitusteksti wizardille / historialle. */
export function formVersionMismatchMessage(
  snapshotVersion: number,
  currentVersion: number,
): string {
  return (
    `Lomakepohjaa on muutettu tämän laskelman tallennuksen jälkeen ` +
    `(versio ${snapshotVersion} → ${currentVersion}). ` +
    `Tarkista kentät ja tulokset ennen uutta tallennusta.`
  );
}
