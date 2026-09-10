import type { AppSettings } from '@/src/core/models/types';
import type { ProductStructure } from '@/src/core/structure/types';

export const DEFAULT_CREW_SIZE = 2;

export function parseCrewSize(value: unknown, fallback = DEFAULT_CREW_SIZE): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

/** Rivin lomake: palkkio-% ja työryhmän koko tästä tuoterakenteesta. */
export function settingsForStructure(
  settings: AppSettings,
  structure: Pick<ProductStructure, 'commissionPercent' | 'crewSize'>,
): AppSettings {
  return {
    ...settings,
    defaultCommissionPercent: structure.commissionPercent,
    defaultCrewSize: parseCrewSize(structure.crewSize, settings.defaultCrewSize),
  };
}
