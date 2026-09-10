import { applyFormResultToLine, patchStructureLine } from '../src/core/structure/applyFormToLine';
import type { CalculationResult } from '../src/core/calculation/calculationPipeline';
import type { StructureLine } from '../src/core/models/types';
import {
  formatDurationDisplayValue,
  normalizeDisplayWorkDurationDays,
  resolveDisplayedWorkDurationDays,
} from '../src/core/structure/workDurationDisplay';

function line(partial: Partial<StructureLine> = {}): StructureLine {
  return {
    id: 'l1',
    structureId: 's1',
    name: 'Ulkoverhoilun maalaus',
    quantity: 1,
    unitPriceVat0: 0,
    materialsVat0: 0,
    discountPercent: 0,
    vatPercent: 25.5,
    contractPriceVat0: 0,
    workDurationDays: 0,
    commissionPercent: 7,
    commissionEur: 0,
    marginEur: 0,
    marginPercent: 0,
    fieldValues: {},
    formFilled: false,
    overrides: [],
    ...partial,
  };
}

const result: CalculationResult = {
  contractPriceVat0: 800,
  materialsVat0: 365,
  marginEur: 2000,
  commissionEur: 237,
  totalPriceVat0: 3223.84,
  vatAmount: 822.08,
  totalPriceVat: 4045.92,
  workDurationDays: 2,
  discountPercent: 5,
  discountEur: 169.68,
  totalPriceVatBeforeDiscount: 4258.47,
  totalPriceVat0BeforeDiscount: 3393.52,
};

describe('resolveDisplayedWorkDurationDays', () => {
  test('applies weather reserve to calculated days', () => {
    expect(resolveDisplayedWorkDurationDays(line({ workDurationDays: 5 }), 1.3)).toBe(7);
    expect(resolveDisplayedWorkDurationDays(line({ workDurationDays: 1 }), 1.3)).toBe(2);
  });

  test('uses structure default when calculation is empty', () => {
    expect(
      resolveDisplayedWorkDurationDays(line({ displayWorkDurationDays: 10, workDurationDays: 0 }), 1.3),
    ).toBe(10);
  });

  test('calculated duration wins over default without an override', () => {
    expect(
      resolveDisplayedWorkDurationDays(
        line({ displayWorkDurationDays: 10, workDurationDays: 5 }),
        1.3,
      ),
    ).toBe(7);
  });

  test('card override wins and is not multiplied by weather reserve again', () => {
    expect(
      resolveDisplayedWorkDurationDays(
        line({
          workDurationDays: 5,
          displayWorkDurationDays: 12,
          overrides: ['workDurationDisplay'],
        }),
        1.3,
      ),
    ).toBe(12);
  });

  test('normalizeDisplayWorkDurationDays ceils to whole days', () => {
    expect(normalizeDisplayWorkDurationDays(8.2)).toBe(9);
    expect(normalizeDisplayWorkDurationDays(0)).toBeUndefined();
    expect(normalizeDisplayWorkDurationDays(-1)).toBeUndefined();
  });

  test('formatDurationDisplayValue omits empty values', () => {
    expect(formatDurationDisplayValue(7)).toBe('7');
    expect(formatDurationDisplayValue(0)).toBeUndefined();
    expect(formatDurationDisplayValue(undefined)).toBeUndefined();
  });
});

describe('display duration override vs pipeline', () => {
  test('override does not change calculated workDurationDays or prices', () => {
    const overridden = patchStructureLine(line({ workDurationDays: 2 }), {
      displayWorkDurationDays: 12,
    });
    expect(overridden.overrides).toContain('workDurationDisplay');
    expect(overridden.displayWorkDurationDays).toBe(12);
    expect(overridden.workDurationDays).toBe(2);

    const next = applyFormResultToLine(overridden, result, { maali: 'x' }, 7);
    expect(next.workDurationDays).toBe(2);
    expect(next.contractPriceVat0).toBe(800);
    expect(next.displayWorkDurationDays).toBe(12);
    expect(next.overrides).toContain('workDurationDisplay');
    expect(resolveDisplayedWorkDurationDays(next, 1.3)).toBe(12);
  });

  test('clearing the override restores weather-adjusted calculation', () => {
    const overridden = patchStructureLine(line({ workDurationDays: 5 }), {
      displayWorkDurationDays: 12,
    });
    const cleared = patchStructureLine(overridden, { displayWorkDurationDays: null });
    expect(cleared.overrides).not.toContain('workDurationDisplay');
    expect(cleared.displayWorkDurationDays).toBeUndefined();
    expect(cleared.workDurationDays).toBe(5);
    expect(resolveDisplayedWorkDurationDays(cleared, 1.3)).toBe(7);
  });
});
