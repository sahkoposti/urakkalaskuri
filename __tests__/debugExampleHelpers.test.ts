import { formatDebugExampleDisplay } from '@/src/core/form/debugExampleHelpers';
import type { FormField } from '@/src/core/form/types';
import type { Product } from '@/src/core/models/types';

const paintProduct: Product = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  name: 'Ulkomaali',
  unit: 'l',
  unitPriceVat0: 12,
  attributes: { consumption: 8 },
  createdAt: new Date('2026-01-01'),
};

function field(partial: Partial<FormField> & Pick<FormField, 'type'>): FormField {
  return {
    id: 'field_test',
    key: 'kautettavamaali',
    label: 'Kautettava maali',
    required: false,
    showOnSummary: true,
    ...partial,
  };
}

describe('formatDebugExampleDisplay', () => {
  test('shows product name instead of id for product_select', () => {
    const result = formatDebugExampleDisplay(
      field({
        type: 'product_select',
        debugExampleValue: paintProduct.id,
      }),
      [paintProduct],
    );
    expect(result).toBe('Ulkomaali');
  });

  test('shows option label instead of numeric value for select', () => {
    const result = formatDebugExampleDisplay(
      field({
        type: 'select',
        key: 'laudoitustyyppi',
        options: [
          { label: 'Paneeli', value: '1.15' },
          { label: 'Hirsi', value: '1' },
        ],
        debugExampleValue: '1.15',
      }),
    );
    expect(result).toBe('Paneeli');
  });

  test('formats boolean debug example', () => {
    expect(
      formatDebugExampleDisplay(
        field({ type: 'boolean', debugExampleValue: 'true' }),
      ),
    ).toBe('Kyllä');
    expect(
      formatDebugExampleDisplay(
        field({ type: 'boolean', debugExampleValue: 'false' }),
      ),
    ).toBe('Ei');
  });

  test('passes through number and text values', () => {
    expect(
      formatDebugExampleDisplay(
        field({ type: 'number', debugExampleValue: '120' }),
      ),
    ).toBe('120');
  });
});
