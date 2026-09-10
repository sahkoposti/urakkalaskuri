import { parseNumber } from '@/src/core/utils/formatters';

/** Laskentasivun matka-aika yhteen suuntaan (h). Sama arvo kaikille tuoterakenneriveille. */
export const CALCULATION_TRAVEL_TIME_HOURS_KEY = 'laskelma.matka_aika_h';

export function parseTravelTimeHoursOneWay(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.max(0, raw) : 0;
  }
  const parsed = parseNumber(String(raw ?? '').trim());
  return parsed != null && Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function formatTravelTimeHoursOneWay(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours)) return '';
  return String(hours).replace('.', ',');
}

/** Kaavamuuttujat laskelmatason kentistä (matka-aika kohteelle). */
export function buildCalculationFormulaContext(input: {
  travelTimeHoursOneWay?: number | string | null;
} = {}): Record<string, number> {
  return {
    [CALCULATION_TRAVEL_TIME_HOURS_KEY]: parseTravelTimeHoursOneWay(input.travelTimeHoursOneWay),
  };
}
