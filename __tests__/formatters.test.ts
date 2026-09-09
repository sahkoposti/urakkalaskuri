import {
  ceilWorkDurationDays,
  displayWorkDurationText,
  estimateWorkDurationDays,
  formatFixed2,
  formatWorkDurationDays,
  limitDecimalInput,
  roundToCents,
} from '../src/core/utils/formatters';

describe('work duration display', () => {
  test('ceils days upward', () => {
    expect(ceilWorkDurationDays(1.1)).toBe(2);
    expect(ceilWorkDurationDays(1)).toBe(1);
    expect(ceilWorkDurationDays(0.1)).toBe(1);
    expect(ceilWorkDurationDays(2.0)).toBe(2);
    expect(formatWorkDurationDays(1.1)).toBe('2');
  });

  test('applies weather reserve factor before ceiling', () => {
    expect(estimateWorkDurationDays(1, 1.3)).toBe(2);
    expect(estimateWorkDurationDays(2, 1.3)).toBe(3);
    expect(estimateWorkDurationDays(5, 1.3)).toBe(7);
    expect(formatWorkDurationDays(1, 1.3)).toBe('2');
    expect(formatWorkDurationDays(10, 1)).toBe('10');
  });

  test('renames crew duration labels', () => {
    expect(displayWorkDurationText('Työryhmän kesto (pv)')).toBe('Työn arvioitu kesto (pv)');
    expect(displayWorkDurationText('Työryhmän kesto (h)')).toBe('Työn arvioitu kesto (h)');
    expect(displayWorkDurationText('Työryhmän arvioitu kesto (pv)')).toBe('Työn arvioitu kesto (pv)');
    expect(displayWorkDurationText('Työn kesto (pv)')).toBe('Työn arvioitu kesto (pv)');
    expect(displayWorkDurationText('Työryhmän keston on oltava suurempi kuin 0.')).toBe(
      'Työn keston on oltava suurempi kuin 0.',
    );
  });
});

describe('decimal helpers', () => {
  test('pyöristää kahteen desimaaliin', () => {
    expect(roundToCents(1.235)).toBe(1.24);
    expect(formatFixed2(10)).toBe('10,00');
    expect(formatFixed2(3.5)).toBe('3,50');
  });

  test('rajaa syötteen kahteen desimaaliin', () => {
    expect(limitDecimalInput('3,555')).toBe('3,55');
    expect(limitDecimalInput('3.1')).toBe('3,1');
    expect(limitDecimalInput('12,')).toBe('12,');
  });
});
