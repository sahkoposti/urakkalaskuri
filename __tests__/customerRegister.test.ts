import {
  customerFromInfo,
  customerMatchLabel,
  customerSnapshotEquals,
  searchCustomersByName,
} from '../src/core/customer/customerRegister';
import type { CustomerRecord } from '../src/core/structure/types';

function customer(partial: Partial<CustomerRecord> & Pick<CustomerRecord, 'id' | 'name'>): CustomerRecord {
  return {
    customerType: 'private',
    reverseVat: false,
    updatedAt: new Date('2026-01-01'),
    ...partial,
  };
}

describe('searchCustomersByName', () => {
  const list = [
    customer({ id: '1', name: 'Jaana Rönkä', postalLocality: 'Piikkiö' }),
    customer({ id: '2', name: 'Jaakko Virtanen', address: 'Turku' }),
    customer({ id: '3', name: 'Matti Meikäläinen' }),
  ];

  test('suodattaa nimen osan mukaan ja rajoittaa tulokset', () => {
    const hits = searchCustomersByName(list, 'jaa', 8);
    expect(hits.map((item) => item.id)).toEqual(['2', '1']);
    expect(customerMatchLabel(hits[1])).toBe('Jaana Rönkä · Piikkiö');
  });

  test('tyhjä haku ei palauta osumia', () => {
    expect(searchCustomersByName(list, '   ')).toEqual([]);
  });
});

describe('customerSnapshotEquals', () => {
  test('tunnistaa muuttuneet yhteystiedot', () => {
    const original = customerFromInfo('c1', { name: 'Jaana', phone: '040' });
    expect(customerSnapshotEquals(original, { name: 'Jaana', phone: '040' })).toBe(true);
    expect(customerSnapshotEquals(original, { name: 'Jaana', phone: '050' })).toBe(false);
  });
});
