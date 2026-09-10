import { parseNumber } from '@/src/core/utils/formatters';

export const LASKELMA_MATKA_AIKA_H = 'laskelma.matka_aika_h';

export type CalculationFormulaValues = {
  /** Matka-aika yhteen suuntaan (h). Tyhjä → 0. */
  matkaAikaH?: number | string | null;
};

/** Tyhjä tai kelvoton arvo on 0. */
export function parseMatkaAikaH(raw: number | string | null | undefined): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? raw : 0;
  }
  const parsed = parseNumber((raw ?? '').trim());
  if (parsed === null || !Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

export function calculationFromTravelTime(
  raw?: string | number | null,
): CalculationFormulaValues {
  return { matkaAikaH: raw };
}

/** Vanhoista lomakearvoista (`etaisyys`), jos laskelmatason kenttää ei vielä ole. */
export function resolveTravelTimeHours(options: {
  travelTimeHours?: string | null;
  fieldValues?: Record<string, string>;
  structureLines?: Array<{ fieldValues?: Record<string, string> }>;
}): string {
  if (options.travelTimeHours != null) return options.travelTimeHours;
  const fromFields = options.fieldValues?.etaisyys?.trim();
  if (fromFields) return fromFields;
  for (const line of options.structureLines ?? []) {
    const value = line.fieldValues?.etaisyys?.trim();
    if (value) return value;
  }
  return '';
}

/** Kaavakonteksti: laskelma.matka_aika_h (tunnit, yhteen suuntaan). */
export function buildCalculationFormulaContext(
  values?: CalculationFormulaValues,
): Record<string, number> {
  return {
    [LASKELMA_MATKA_AIKA_H]: parseMatkaAikaH(values?.matkaAikaH),
  };
}
