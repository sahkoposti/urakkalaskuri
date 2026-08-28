import { formatCurrency, formatDecimal, parseNumber } from '../src/core/utils/formatters';

describe('formatters', () => {
  test('parseNumber accepts comma decimals', () => {
    expect(parseNumber('1,5')).toBe(1.5);
    expect(parseNumber('10.25')).toBe(10.25);
    expect(parseNumber('abc')).toBeNull();
  });

  test('formatDecimal uses one fraction digit', () => {
    expect(formatDecimal(1)).toBe('1,0');
    expect(formatDecimal(12.34)).toBe('12,3');
  });

  test('formatCurrency uses euro with two decimals', () => {
    expect(formatCurrency(12.3)).toMatch(/12,30/);
  });
});
