import {
  findProductById,
  productsForStructureForm,
  searchProductsByName,
  selectedProductPickerValue,
} from '../src/core/form/productFieldUtils';
import type { FormField } from '../src/core/form/types';
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

  test('default product search Henkilönostin Dino180 is case-insensitive', () => {
    expect(findProductById([dino, other], '  henkilönostin dino180  ')?.id).toBe('lift-dino-180');
  });

  test('matches Dino180 even if the stored name has a space', () => {
    const spaced = { ...dino, name: 'Henkilönostin Dino 180' };
    expect(findProductById([spaced, other], 'Henkilönostin Dino180')?.id).toBe('lift-dino-180');
  });

  test('returns null when missing', () => {
    expect(findProductById([dino], 'Tuntematon')).toBeNull();
    expect(findProductById([dino], '')).toBeNull();
  });

  test('ambiguous partial name is not guessed', () => {
    expect(findProductById([dino, other], 'Henkilönostin')).toBeNull();
  });

  test('picker value is the product id even when default is a name', () => {
    expect(selectedProductPickerValue([dino, other], 'Henkilönostin Dino180')).toBe('lift-dino-180');
    expect(selectedProductPickerValue([dino], 'missing')).toBe('');
  });
});

describe('searchProductsByName', () => {
  test('finds Henkilönostin Dino180', () => {
    expect(searchProductsByName([dino, other], 'Henkilönostin Dino180').map((item) => item.id)).toEqual([
      'lift-dino-180',
    ]);
  });
});

describe('productsForStructureForm', () => {
  const liftField: FormField = {
    id: 'field_henkilonostin',
    key: 'henkilonostin',
    label: 'Vuokrattava nostin',
    type: 'product_select',
    required: true,
    showOnSummary: true,
    defaultValue: 'Henkilönostin Dino180',
  };

  test('includes default-named product even when it is not on the structure', () => {
    const paint = {
      ...other,
      id: 'paint-1',
      name: 'Maali',
      structureIds: ['julkisivu'],
    };
    const unassignedLift = { ...dino, structureIds: [] as string[] };
    const available = productsForStructureForm(
      { fields: [liftField] },
      [paint, unassignedLift],
      'julkisivu',
    );
    expect(available.map((item) => item.id)).toEqual(['paint-1', 'lift-dino-180']);
  });
});
