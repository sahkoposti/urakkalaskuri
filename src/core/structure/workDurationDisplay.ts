import { structureLineQuantityIsZero } from '@/src/core/materials/structureLineQuantity';
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

function lineDurationHours(
  line: WorkDurationDisplayLine,
  workdayHours: number,
): number {
  const overrides = line.overrides ?? [];
  if (overrides.includes('workDurationDisplay')) {
    const overridden = normalizeDisplayWorkDurationDays(line.displayWorkDurationDays);
    if (overridden != null && workdayHours > 0) return overridden * workdayHours;
    return 0;
  }
  if (line.workDurationDays > 0) {
    return scaleWorkDuration(line.workDurationDays, line.quantity, workdayHours).hours;
  }
  const fallback = normalizeDisplayWorkDurationDays(line.displayWorkDurationDays);
  if (fallback != null && workdayHours > 0) return fallback * workdayHours;
  return 0;
}

/**
 * Urakkakortin ja yhteenvedon kesto usealta rakenteelta.
 * Tunnit: `scaleWorkDuration` per rivi (määrä 0 pois). Päivät: kokonaistunnit / työpäivän pituus.
 * Säävaraus ja ylöspyöristys kerran, kuten yhden rivin kortilla. Ei tallenna laskelmaan.
 */
export function resolveAggregateDisplayedWorkDurationDays(
  lines: readonly WorkDurationDisplayLine[],
  weatherReserveFactor = 1,
  workdayHours = defaultSettings.workdayHours,
): number | undefined {
  const active = lines.filter((line) => !structureLineQuantityIsZero({ quantity: line.quantity }));
  if (active.length === 0) return undefined;
  if (active.length === 1) {
    return resolveDisplayedWorkDurationDays(active[0], weatherReserveFactor, workdayHours);
  }
  const dayLength = Number.isFinite(workdayHours) && workdayHours > 0 ? workdayHours : 0;
  if (dayLength === 0) return undefined;
  const totalHours = active.reduce((sum, line) => sum + lineDurationHours(line, dayLength), 0);
  if (!(totalHours > 0)) return undefined;
  return estimateWorkDurationDays(totalHours / dayLength, weatherReserveFactor);
}

/**
 * Laskelmanäkymän kokonaiskesto (PriceBreakdownCard).
 * Yksi rivi tai legacy-rivi: kuten kortilla. Usea rivi: sama kuin urakkakortti.
 */
export function resolveRecordDisplayedWorkDurationDays(
  lines: readonly WorkDurationDisplayLine[],
  weatherReserveFactor = 1,
  workdayHours = defaultSettings.workdayHours,
): number | undefined {
  if (lines.length > 1) {
    return resolveAggregateDisplayedWorkDurationDays(lines, weatherReserveFactor, workdayHours);
  }
  if (lines.length === 1) {
    return resolveDisplayedWorkDurationDays(lines[0], weatherReserveFactor, workdayHours);
  }
  return undefined;
}
