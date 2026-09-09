import {
  lookupPostalLocality,
  normalizePostalCode,
} from '../src/core/customer/varsinaisSuomiPostalCodes';

describe('varsinaisSuomiPostalCodes', () => {
  test('normalizePostalCode keeps five digits', () => {
    expect(normalizePostalCode('20100')).toBe('20100');
    expect(normalizePostalCode('20 100')).toBe('20100');
    expect(normalizePostalCode('abc20780xyz')).toBe('20780');
    expect(normalizePostalCode('201001')).toBe('20100');
  });

  test('lookup fills locality for Varsinais-Suomi codes', () => {
    expect(lookupPostalLocality('20100')).toBe('Turku');
    expect(lookupPostalLocality('20780')).toBe('Kaarina');
    expect(lookupPostalLocality('21200')).toBe('Raisio');
    expect(lookupPostalLocality('20660')).toBe('Littoinen');
    expect(lookupPostalLocality('24100')).toBe('Salo');
  });

  test('unknown or incomplete codes return undefined', () => {
    expect(lookupPostalLocality('2010')).toBeUndefined();
    expect(lookupPostalLocality('00100')).toBeUndefined();
    expect(lookupPostalLocality('')).toBeUndefined();
  });
});
