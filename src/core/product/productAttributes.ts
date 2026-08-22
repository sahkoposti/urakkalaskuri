import { parseNumber } from '@/src/core/utils/formatters';

export const KNOWN_PRODUCT_ATTRIBUTES = [
  'consumption',
  'work_factor',
  'material_factor',
  'purchase_price',
  'sale_price',
] as const;

export type KnownProductAttribute = (typeof KNOWN_PRODUCT_ATTRIBUTES)[number];

export function parseProductAttributesJson(raw: string | null | undefined): Record<string, number> | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const attributes: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        attributes[key] = value;
      }
    }
    return Object.keys(attributes).length > 0 ? attributes : undefined;
  } catch {
    return undefined;
  }
}

export function buildProductAttributes(
  consumption: string,
  workFactor: string,
  materialFactor: string,
): Record<string, number> | undefined {
  const attributes: Record<string, number> = {};
  const consumptionValue = parseNumber(consumption.trim());
  if (consumptionValue !== null && consumptionValue > 0) {
    attributes.consumption = consumptionValue;
  }
  const workFactorValue = parseNumber(workFactor.trim());
  if (workFactorValue !== null && workFactorValue > 0) {
    attributes.work_factor = workFactorValue;
  }
  const materialFactorValue = parseNumber(materialFactor.trim());
  if (materialFactorValue !== null && materialFactorValue > 0) {
    attributes.material_factor = materialFactorValue;
  }
  return Object.keys(attributes).length > 0 ? attributes : undefined;
}

export function attributeFieldValues(attributes?: Record<string, number>): {
  consumption: string;
  workFactor: string;
  materialFactor: string;
} {
  return {
    consumption: attributes?.consumption !== undefined ? String(attributes.consumption) : '',
    workFactor: attributes?.work_factor !== undefined ? String(attributes.work_factor) : '',
    materialFactor: attributes?.material_factor !== undefined ? String(attributes.material_factor) : '',
  };
}
