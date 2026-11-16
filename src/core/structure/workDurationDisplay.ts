import { defaultSettings, type StructureLine } from '@/src/core/models/types';
import { scaleWorkDuration } from '@/src/core/structure/lineQuantityScale';
import { ceilWorkDurationDays, estimateWorkDurationDays } from '@/src/core/utils/formatters';

export const WORK_DURATION_DISPLAY_LABEL = 'Työn arvioitu kesto (pv)';

export type WorkDurationDisplayLine = Pick<
  StructureLine,
  'overrides' | 'displayWorkDurationDays' | 'workDurationDays'
> & { quantity?: number };

/** Yhteenvedon päiväluku (säävaraus mukana): kokonaisluku, vähintään 1. */
export function normalizeDisplayWorkDurationDays(
  value: number | null | undefined,
): number | undefined {
  if (value == null || !Number.isFinite(value) || value <= 0) return undefined;
  return ceilWorkDurationDays(value);
}

export function formatDurationDisplayValue(days: number | undefined): string | undefined {
  const normalized = normalizeDisplayWorkDurationDays(days);
  return normalized == null ? undefined : String(normalized);
}

/**
 * Rivikortilla ja yhteenvedossa näytettävä työn arvioitu kesto (pv).
 * Kortin yliajo on jo säävarauksen jälkeinen kokonaisluku eikä muuta laskentaa.
 */
export function resolveDisplayedWorkDurationDays(
  line: WorkDurationDisplayLine,
  weatherReserveFactor = 1,
  workdayHours = defaultSettings.workdayHours,
): number | undefined {
  const overrides = line.overrides ?? [];
  if (overrides.includes('workDurationDisplay')) {
    const overridden = normalizeDisplayWorkDurationDays(line.displayWorkDurationDays);
    if (overridden != null) return overridden;
  }
  if (line.workDurationDays > 0) {
    const scaled = scaleWorkDuration(line.workDurationDays, line.quantity, workdayHours).days;
    return estimateWorkDurationDays(scaled, weatherReserveFactor);
  }
  return normalizeDisplayWorkDurationDays(line.displayWorkDurationDays);
}
