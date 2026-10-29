import type { AppSettings } from '@/src/core/models/types';
import type { ProductStructure } from '@/src/core/structure/types';

export const DEFAULT_CREW_SIZE = 2;

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

/** Positiivinen €/h, muuten `fallback` (Yleinen-asetus). */
export function parseHourlyRate(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
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
