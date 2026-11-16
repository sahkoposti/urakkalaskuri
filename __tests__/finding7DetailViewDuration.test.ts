import { defaultSettings } from '../src/core/models/types';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import { ensureStructureLines } from '../src/core/structure/legacyCalculation';
import {
  resolveAggregateDisplayedWorkDurationDays,
  resolveRecordDisplayedWorkDurationDays,
} from '../src/core/structure/workDurationDisplay';

import { input, line, record } from './pdfFixtures';

const SETTINGS = { ...defaultSettings, workdayHours: 8, weatherReserveFactor: 1.3 };

describe('Finding 7: calculation detail total duration', () => {
  test('multi-structure matches urakkakortti; qty 0 ignored; legacy stored duration unchanged', () => {
    const lines = [
      { ...line('a', 's1', 'Rakenne A'), workDurationDays: 3, quantity: 1 },
      { ...line('b', 's2', 'Rakenne B'), workDurationDays: 2, quantity: 1 },
    ];
    const rec = record({}, { structureLines: lines, workDurationDays: 0 });
    const ensured = ensureStructureLines(rec);

    const detailDays = resolveRecordDisplayedWorkDurationDays(
      ensured,
      SETTINGS.weatherReserveFactor,
      SETTINGS.workdayHours,
    );
    const aggregateDays = resolveAggregateDisplayedWorkDurationDays(
      lines,
      SETTINGS.weatherReserveFactor,
      SETTINGS.workdayHours,
    );
    expect(detailDays).toBe(aggregateDays);
    expect(detailDays).toBe(7);

    const ctx = buildUrakkakorttiContext({ ...input(rec), settings: SETTINGS });
    expect(ctx.infoRows).toContainEqual({ label: 'Työn arvioitu kesto', value: '7 pv' });

    const qtyLines = [
      { ...line('c', 's1', 'A'), workDurationDays: 3, quantity: 1 },
      { ...line('z', 's3', 'Piilo'), workDurationDays: 9, quantity: 0 },
    ];
    const withZero = resolveRecordDisplayedWorkDurationDays(
      ensureStructureLines(record({}, { structureLines: qtyLines, workDurationDays: 0 })),
      SETTINGS.weatherReserveFactor,
      SETTINGS.workdayHours,
    );
    expect(withZero).toBe(4);

    const legacy = record({}, {
      workDurationDays: 5,
      structureLines: undefined,
    });
    const legacyDuration = resolveRecordDisplayedWorkDurationDays(
      ensureStructureLines(legacy),
      SETTINGS.weatherReserveFactor,
      SETTINGS.workdayHours,
    );
    expect(legacyDuration).toBe(7);
  });
});