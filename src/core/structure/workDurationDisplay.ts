import type { StructureLine } from '@/src/core/models/types';
import { ceilWorkDurationDays, estimateWorkDurationDays } from '@/src/core/utils/formatters';

export type WorkDurationDisplayLine = Pick<
  StructureLine,
  'overrides' | 'displayWorkDurationDays' | 'workDurationDays'
>;

/** Yhteenvedon päiväluku (säävaraus mukana): kokonaisluku, vähintään 1. */
export function normalizeDisplayWorkDurationDays(
  value: number | null | undefined,
): number | undefined {
  if (value == null || !Number.isFinite(value) || value <= 0) return undefined;
  return ceilWorkDurationDays(value);
}

/**
 * Lomakkeella ja yhteenvedossa näytettävä työn arvioitu kesto (pv).
 * Kortin yliajo on jo säävarauksen jälkeinen kokonaisluku eikä muuta laskentaa.
 */
export function resolveDisplayedWorkDurationDays(
  line: WorkDurationDisplayLine,
  weatherReserveFactor = 1,
): number | undefined {
  const overrides = line.overrides ?? [];
  if (overrides.includes('workDurationDisplay')) {
    const overridden = normalizeDisplayWorkDurationDays(line.displayWorkDurationDays);
    if (overridden != null) return overridden;
  }
  if (line.workDurationDays > 0) {
    return estimateWorkDurationDays(line.workDurationDays, weatherReserveFactor);
  }
  return normalizeDisplayWorkDurationDays(line.displayWorkDurationDays);
}
