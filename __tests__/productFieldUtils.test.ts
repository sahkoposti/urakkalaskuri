import {
  findProductById,
  selectedProductPickerValue,
} from '../src/core/form/productFieldUtils';
import type { Product } from '../src/core/models/types';

const dino: Product = {
  id: 'lift-dino-180',
  name: 'Henkilönostin Dino180',
  unit: 'pv',
  unitPriceVat0: 120,
  createdAt: new Date('2026-01-01'),
};

const other: Product = {
  id: 'lift-other',
  name: 'Henkilönostin 12m',
  unit: 'pv',
  unitPriceVat0: 90,
  createdAt: new Date('2026-01-01'),
};

describe('findProductById', () => {
  test('matches by id', () => {
    expect(findProductById([dino, other], 'lift-dino-180')?.name).toBe('Henkilönostin Dino180');
  });

  test('matches by name ignoring case and surrounding space', () => {
    expect(findProductById([dino, other], '  henkilönostin dino180  ')?.id).toBe('lift-dino-180');
  });

  test('returns null when missing', () => {
    expect(findProductById([dino], 'Tuntematon')).toBeNull();
    expect(findProductById([dino], '')).toBeNull();
  });

  test('picker value is the product id even when default is a name', () => {
    expect(selectedProductPickerValue([dino, other], 'Henkilönostin Dino180')).toBe('lift-dino-180');
    expect(selectedProductPickerValue([dino], 'missing')).toBe('');
  });
});
