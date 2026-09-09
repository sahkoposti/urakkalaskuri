import { computedFieldsAffectedByKeyChange } from '@/src/core/form/formula/formulaDependencies';
import type { FormDefinition } from '@/src/core/form/types';
import { parseNumber } from '@/src/core/utils/formatters';

const SELLING_PRICE_VAT0_KEY = 'kokonaishinta_alv0';
const SELLING_PRICE_VAT_KEY = 'kokonaishinta';

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

/** Yliajettu numero, tai null jos avainta ei ole / arvo ei ole numero. */
export function parsedComputedOverride(
  form: FormDefinition,
  fieldValues: Record<string, string>,
  key: string,
): number | null {
  if (!isComputedFieldOverridden(form, fieldValues, key)) return null;
  return parseNumber(fieldValues[key]?.trim() ?? '');
}

export function overriddenComputedKeys(
  form: FormDefinition,
  fieldValues: Record<string, string>,
): string[] {
  return form.fields
    .filter((field) => field.type === 'computed' && isComputedFieldOverridden(form, fieldValues, field.key))
    .map((field) => field.key);
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

  if (trimmed && prev[key] === value) return prev;

  const next = { ...prev };
  if (!trimmed) {
    // Explicit empty keeps the field cleared; omitting the key would show defaultValue again.
    next[key] = '';
  } else {
    next[key] = value;
  }

  for (const computedKey of computedFieldsAffectedByKeyChange(form, key)) {
    if (computedKey === key) continue;
    delete next[computedKey];
  }

  if (key === SELLING_PRICE_VAT_KEY) {
    delete next[SELLING_PRICE_VAT0_KEY];
  } else if (key === SELLING_PRICE_VAT0_KEY) {
    delete next[SELLING_PRICE_VAT_KEY];
  }

  return next;
}
