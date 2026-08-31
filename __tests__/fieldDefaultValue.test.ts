import { resolveFieldRawValue, supportsDefaultValue, normalizeDefaultValue } from '../src/core/form/fieldDefaultValue';
import type { FormField } from '../src/core/form/types';

function field(key: string, type: FormField['type'], defaultValue?: string): FormField {
  return {
    id: `field_${key}`,
    key,
    label: key,
    type,
    required: false,
    showOnSummary: true,
    defaultValue,
  };
}

describe('fieldDefaultValue', () => {
  test('resolveFieldRawValue uses default when user has not edited', () => {
    const formField = field('pinta_ala', 'number', '120');
    expect(resolveFieldRawValue(formField, {})).toBe('120');
  });

  test('empty default resolves to empty string, not zero', () => {
    const formField = field('pinta_ala', 'number');
    expect(resolveFieldRawValue(formField, {})).toBe('');
  });

  test('user value overrides default', () => {
    const formField = field('pinta_ala', 'number', '120');
    expect(resolveFieldRawValue(formField, { pinta_ala: '90' })).toBe('90');
  });

  test('user empty value is kept over default', () => {
    const formField = field('pinta_ala', 'number', '120');
    expect(resolveFieldRawValue(formField, { pinta_ala: '' })).toBe('');
  });

  test('normalizeDefaultValue removes empty strings', () => {
    expect(normalizeDefaultValue('  ')).toBeUndefined();
    expect(normalizeDefaultValue('120')).toBe('120');
  });

  test('supportsDefaultValue excludes computed and section', () => {
    expect(supportsDefaultValue(field('x', 'number'))).toBe(true);
    expect(supportsDefaultValue(field('x', 'computed'))).toBe(false);
    expect(supportsDefaultValue(field('x', 'section'))).toBe(false);
  });
});
