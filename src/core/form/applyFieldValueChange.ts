import { computedFieldsAffectedByKeyChange } from '@/src/core/form/formula/formulaDependencies';
import type { FormDefinition } from '@/src/core/form/types';

/**
 * Päivittää wizardin kenttäarvon ja poistaa niiden laskentakenttien manuaaliset
 * ohitukset, joiden kaava riippuu muuttuneesta avaimesta. Itse muokattu
 * laskentakenttä säilyttää manuaalisen arvon.
 */
export function applyFieldValueChange(
  form: FormDefinition,
  prev: Record<string, string>,
  key: string,
  value: string,
): Record<string, string> {
  const trimmed = value.trim();
  const had = Object.prototype.hasOwnProperty.call(prev, key);

  if (!trimmed && !had) return prev;
  if (trimmed && prev[key] === value) return prev;

  const next = { ...prev };
  if (!trimmed) {
    delete next[key];
  } else {
    next[key] = value;
  }

  for (const computedKey of computedFieldsAffectedByKeyChange(form, key)) {
    if (computedKey === key) continue;
    delete next[computedKey];
  }

  return next;
}
