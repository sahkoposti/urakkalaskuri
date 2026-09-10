import type { FieldType, FormField } from '@/src/core/form/types';
import { legacyKeysForCurrentKey } from '@/src/core/form/systemFields';

const DEFAULT_VALUE_FIELD_TYPES = new Set<FieldType>([
  'number',
  'text',
  'select',
  'boolean',
  'product_select',
]);

export function supportsDefaultValue(field: Pick<FormField, 'type'>): boolean {
  return DEFAULT_VALUE_FIELD_TYPES.has(field.type);
}

export function fieldHasUserValue(fieldValues: Record<string, string>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(fieldValues, key);
}

/** Wizardin näyttöarvo / validointi: käyttäjän arvo tai kentän oletus (tyhjä jos ei kumpaakaan). */
export function resolveFieldRawValue(
  field: Pick<FormField, 'key' | 'defaultValue'>,
  fieldValues: Record<string, string>,
): string {
  if (fieldHasUserValue(fieldValues, field.key)) {
    return fieldValues[field.key] ?? '';
  }
  for (const legacy of legacyKeysForCurrentKey(field.key)) {
    if (fieldHasUserValue(fieldValues, legacy)) {
      return fieldValues[legacy] ?? '';
    }
  }
  return field.defaultValue?.trim() ?? '';
}

export function normalizeDefaultValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
