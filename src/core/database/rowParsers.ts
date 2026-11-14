import { sanitizeMaterialQuantities } from '../materials/materialQuantities';
import type { FormSnapshot, StructureLine } from '../models/types';
import { defaultSettings } from '../models/types';
import { withDerivedLinePricing } from '../structure/linePricing';

export const ACTIVE_STRUCTURE_KEY = 'active_structure_id';

export function inferVatPercent(row: Record<string, unknown>): number {
  const totalVat0 = row.total_price_vat0 as number;
  const vatAmount = row.vat_amount as number;
  if (totalVat0 <= 0 || vatAmount <= 0) {
    return defaultSettings.vatPercent;
  }
  return (vatAmount / totalVat0) * 100;
}

export function parseFormSnapshot(raw: unknown): FormSnapshot | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  try {
    return JSON.parse(raw) as FormSnapshot;
  } catch {
    return undefined;
  }
}

export function parseStructureLines(raw: unknown): StructureLine[] | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as StructureLine[];
    if (!Array.isArray(parsed) || parsed.length === 0) return undefined;
    return parsed.map((line) => {
      const next = { ...line };
      if (Object.prototype.hasOwnProperty.call(line, 'materialQuantities')) {
        const quantities = sanitizeMaterialQuantities(line.materialQuantities);
        if (quantities === undefined) delete next.materialQuantities;
        else next.materialQuantities = quantities;
      }
      return withDerivedLinePricing(next);
    });
  } catch {
    return undefined;
  }
}
