import {
  ceilWorkDurationDays,
  displayWorkDurationText,
  formatWorkDurationDays,
} from '../src/core/utils/formatters';

describe('work duration display', () => {
  test('ceils days upward', () => {
    expect(ceilWorkDurationDays(1.1)).toBe(2);
    expect(ceilWorkDurationDays(1)).toBe(1);
    expect(ceilWorkDurationDays(0.1)).toBe(1);
    expect(ceilWorkDurationDays(2.0)).toBe(2);
    expect(formatWorkDurationDays(1.1)).toBe('2');
  });

  test('renames crew duration labels', () => {
    expect(displayWorkDurationText('Työryhmän kesto (pv)')).toBe('Työn kesto (pv)');
    expect(displayWorkDurationText('Työryhmän kesto (h)')).toBe('Työn kesto (h)');
    expect(displayWorkDurationText('Työryhmän arvioitu kesto (pv)')).toBe('Työn kesto (pv)');
    expect(displayWorkDurationText('Työryhmän keston on oltava suurempi kuin 0.')).toBe(
      'Työn keston on oltava suurempi kuin 0.',
    );
  });
});
