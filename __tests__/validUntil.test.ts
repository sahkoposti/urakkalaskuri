import { formatFinnishDate, validUntil } from '../src/core/pdf/validUntil';

describe('validUntil', () => {
  it('adds calendar days across month boundary', () => {
    expect(formatFinnishDate(validUntil(new Date(2026, 9, 10, 15, 30), 31))).toBe('10.11.2026');
  });

  it('handles year boundary and leap day', () => {
    expect(formatFinnishDate(validUntil(new Date(2026, 11, 15), 31))).toBe('15.1.2027');
    expect(formatFinnishDate(validUntil(new Date(2028, 1, 28), 1))).toBe('29.2.2028');
  });

  it('treats invalid or negative days as 0', () => {
    expect(formatFinnishDate(validUntil(new Date(2026, 9, 10), Number.NaN))).toBe('10.10.2026');
    expect(formatFinnishDate(validUntil(new Date(2026, 9, 10), -3))).toBe('10.10.2026');
  });

  it('formats d.M.yyyy without leading zeros', () => {
    expect(formatFinnishDate(new Date(2026, 0, 5))).toBe('5.1.2026');
  });
});
