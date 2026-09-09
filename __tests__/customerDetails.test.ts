import {
  emptyCustomerInfo,
  parseCustomerDetails,
  serializeCustomerDetails,
} from '../src/core/models/types';

describe('customer details', () => {
  test('serializes postal fields', () => {
    const json = serializeCustomerDetails({
      ...emptyCustomerInfo(),
      name: 'Matti',
      phone: '040123',
      address: 'Katu 1',
      postalCode: '20100',
      postalLocality: 'Turku',
    });
    expect(JSON.parse(json)).toMatchObject({
      phone: '040123',
      address: 'Katu 1',
      postalCode: '20100',
      postalLocality: 'Turku',
    });
  });

  test('parses old records without postal fields', () => {
    const parsed = parseCustomerDetails(
      JSON.stringify({ customerType: 'private', reverseVat: false, phone: '040' }),
    );
    expect(parsed.phone).toBe('040');
    expect(parsed.postalCode).toBeUndefined();
    expect(parsed.postalLocality).toBeUndefined();
  });
});
