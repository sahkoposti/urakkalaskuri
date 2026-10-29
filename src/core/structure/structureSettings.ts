import type { AppSettings } from '@/src/core/models/types';
import type { ProductStructure } from '@/src/core/structure/types';

export const DEFAULT_CREW_SIZE = 2;

/** Yläraja tuoterakenteen tuntipalkalle (€/h, alv 0). */
export const MAX_HOURLY_RATE = 500;

/** Kentän tekstit yhdessä paikassa. */
export const HOURLY_RATE_FIELD = {
  label: 'Tuntihinta, €/h (alv 0 %)',
  help: 'Tuntihinta ilman arvonlisäveroa. Käytetään sekä tekijöiden urakkahinnassa että asiakashinnan kentissä. Tyhjä = yleinen tuntihinta (Asetukset → Yleinen).',
  invalid:
    'Anna tuntihinta, joka on suurempi kuin 0 ja enintään 500 €/h. Esimerkki: 45,5.',
} as const;

/** Pelkkä ei-negatiivinen desimaali, piste tai pilkku. Ei eksponenttia, välejä tai yksiköitä. */
const HOURLY_RATE_INPUT = /^\d+(?:[.,]\d+)?$/;

export function formatHourlyRate(value: number): string {
  if (!Number.isFinite(value)) return '';
  return String(value).replace('.', ',');
}

/** Paikkamerkki: yleinen tuntihinta pilkkudesimaalina. */
export function hourlyRatePlaceholder(generalRate: number): string {
  return formatHourlyRate(generalRate);
}

function isAcceptableHourlyRate(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= MAX_HOURLY_RATE;
}

/**
 * Tyhjä = ei rakenteen omaa hintaa (`null`).
 * Kelvollinen luku tai `'invalid'`.
 */
export function parseHourlyRateInput(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!HOURLY_RATE_INPUT.test(trimmed)) return 'invalid';
  const parsed = Number(trimmed.replace(',', '.'));
  if (!isAcceptableHourlyRate(parsed)) return 'invalid';
  return parsed;
}

/** Tietokannasta tai kaavaan: kelvoton arvo jää pois (Yleinen-fallback). */
export function storedHourlyRate(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return isAcceptableHourlyRate(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const parsed = parseHourlyRateInput(value);
    return typeof parsed === 'number' ? parsed : undefined;
  }
  return undefined;
}

export type StructurePricingSettings = Pick<ProductStructure, 'commissionPercent' | 'crewSize'> &
  Partial<
    Pick<
      ProductStructure,
      | 'hourlyRate'
      | 'marginLowAmount'
      | 'marginLowPercent'
      | 'marginHighAmount'
      | 'marginHighPercent'
    >
  >;

export function parseCrewSize(value: unknown, fallback = DEFAULT_CREW_SIZE): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

/** Kelvollinen €/h, muuten `fallback` (Yleinen-asetus). Sama sääntö kuin syötteen parserissa. */
export function parseHourlyRate(value: unknown, fallback: number): number {
  return storedHourlyRate(value) ?? fallback;
}

export function parseMarginAmount(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function parseMarginPercent(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(99, Math.max(0, parsed));
}

/** Kate-% + palkkio-% alle 100. */
export function maxMarginPercent(commissionPercent: number): number {
  return Math.max(0, 99 - commissionPercent);
}

export function structureMarginFromSettings(settings: AppSettings): {
  marginLowAmount: number;
  marginLowPercent: number;
  marginHighAmount: number;
  marginHighPercent: number;
} {
  return {
    marginLowAmount: settings.marginLowAmount,
    marginLowPercent: settings.marginLowPercent,
    marginHighAmount: settings.marginHighAmount,
    marginHighPercent: settings.marginHighPercent,
  };
}

export function resolvedStructureMargin(
  structure: StructurePricingSettings,
  fallback: AppSettings,
): {
  marginLowAmount: number;
  marginLowPercent: number;
  marginHighAmount: number;
  marginHighPercent: number;
} {
  return {
    marginLowAmount: parseMarginAmount(structure.marginLowAmount, fallback.marginLowAmount),
    marginLowPercent: parseMarginPercent(structure.marginLowPercent, fallback.marginLowPercent),
    marginHighAmount: parseMarginAmount(structure.marginHighAmount, fallback.marginHighAmount),
    marginHighPercent: parseMarginPercent(structure.marginHighPercent, fallback.marginHighPercent),
  };
}

/** Rivin lomake: palkkio-%, työryhmän koko, tuntipalkka ja kate tästä tuoterakenteesta. */
export function settingsForStructure(
  settings: AppSettings,
  structure: StructurePricingSettings,
): AppSettings {
  const margin = resolvedStructureMargin(structure, settings);
  return {
    ...settings,
    defaultCommissionPercent: structure.commissionPercent,
    defaultCrewSize: parseCrewSize(structure.crewSize, settings.defaultCrewSize),
    defaultHourlyRate: parseHourlyRate(structure.hourlyRate, settings.defaultHourlyRate),
    defaultMarginPercent: margin.marginLowPercent,
    ...margin,
  };
}
