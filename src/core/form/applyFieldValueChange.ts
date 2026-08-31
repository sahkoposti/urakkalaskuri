import { computedFieldsAffectedByKeyChange } from '@/src/core/form/formula/formulaDependencies';
import type { FormDefinition } from '@/src/core/form/types';

function findField(form: FormDefinition, key: string) {
  return form.fields.find((field) => field.key === key);
}

function keepsEmptyComputedOverride(form: FormDefinition, key: string): boolean {
  const field = findField(form, key);
  return field?.type === 'computed' && field.allowManualOverride !== false;
}

export function isComputedFieldOverridden(
  form: FormDefinition,
  fieldValues: Record<string, string>,
  key: string,
): boolean {
  return keepsEmptyComputedOverride(form, key) && Object.prototype.hasOwnProperty.call(fieldValues, key);
}

export function resetComputedFieldOverride(
  fieldValues: Record<string, string>,
  key: string,
): Record<string, string> {
  if (!Object.prototype.hasOwnProperty.call(fieldValues, key)) return fieldValues;
  const next = { ...fieldValues };
  delete next[key];
  return next;
}

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
  const manualComputed = keepsEmptyComputedOverride(form, key);

  if (!trimmed && !had) {
    if (manualComputed) {
      return { ...prev, [key]: '' };
    }
    return prev;
  }
  if (trimmed && prev[key] === value) return prev;

  const next = { ...prev };
  if (!trimmed) {
    if (manualComputed && had) {
      next[key] = '';
    } else {
      delete next[key];
    }
  } else {
    next[key] = value;
  }

  for (const computedKey of computedFieldsAffectedByKeyChange(form, key)) {
    if (computedKey === key) continue;
    delete next[computedKey];
  }

  return next;
}
