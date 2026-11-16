import { defaultSettings } from '../src/core/models/types';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import { scaleWorkDuration } from '../src/core/structure/lineQuantityScale';
import { resolveAggregateDisplayedWorkDurationDays } from '../src/core/structure/workDurationDisplay';
import { input, line, record } from './pdfFixtures';

const SETTINGS = { ...defaultSettings, workdayHours: 8, weatherReserveFactor: 1 };

describe('Finding 7: multi-structure urakkakortti duration from line hours', () => {
  test('3 pv + 2 pv → 40 h / 5 pv; määrä 26 h → 3,25 pv; zero line ignored; label Työn arvioitu kesto', () => {
    const lines = [
      { ...line('a', 's1', 'Rakenne A'), workDurationDays: 3, quantity: 1 },
      { ...line('b', 's2', 'Rakenne B'), workDurationDays: 2, quantity: 1 },
    ];
    const rec = record({}, { structureLines: lines, workDurationDays: 0 });
    const ctx = buildUrakkakorttiContext({ ...input(rec), settings: SETTINGS });
    expect(ctx.infoRows).toContainEqual({ label: 'Työn arvioitu kesto', value: '5 pv' });

    const scaledA = scaleWorkDuration(3, 1, 8);
    const scaledB = scaleWorkDuration(2, 1, 8);
    expect(scaledA.hours + scaledB.hours).toBe(40);
    expect(resolveAggregateDisplayedWorkDurationDays(lines, 1, 8)).toBe(5);

    const qtyLines = [
      { ...line('c', 's1', 'A'), workDurationDays: 6 / 8, quantity: 3 },
      { ...line('d', 's2', 'B'), workDurationDays: 1, quantity: 1 },
      { ...line('z', 's3', 'Piilo'), workDurationDays: 9, quantity: 0 },
    ];
    expect(scaleWorkDuration(6 / 8, 3, 8).hours + scaleWorkDuration(1, 1, 8).hours).toBe(26);
    expect(26 / 8).toBeCloseTo(3.25, 10);
    expect(resolveAggregateDisplayedWorkDurationDays(qtyLines, 1, 8)).toBe(4);
    const zeroCtx = buildUrakkakorttiContext({
      ...input(record({}, { structureLines: qtyLines, workDurationDays: 0 })),
      settings: SETTINGS,
    });
    expect(zeroCtx.infoRows).toContainEqual({ label: 'Työn arvioitu kesto', value: '4 pv' });

    const overrideLines = [
      {
        ...line('o', 's1', 'Yliajo'),
        workDurationDays: 1,
        quantity: 1,
        displayWorkDurationDays: 10,
        overrides: ['workDurationDisplay' as const],
      },
      { ...line('n', 's2', 'Normaali'), workDurationDays: 1, quantity: 1 },
    ];
    expect(resolveAggregateDisplayedWorkDurationDays(overrideLines, 1, 8)).toBe(11);
  });
});