import { parseNumber } from '@/src/core/utils/formatters';

export const KNOWN_PRODUCT_ATTRIBUTES = ['consumption', 'work_factor', 'purchase_price', 'sale_price'] as const;

export type KnownProductAttribute = (typeof KNOWN_PRODUCT_ATTRIBUTES)[number];

const STRIPPED_ATTRIBUTES = new Set(['material_factor', 'materiaalikerroin']);

const CONSUMPTION_KEYS = ['consumption', 'menekki'] as const;
const WORK_FACTOR_KEYS = ['work_factor', 'tyokerroin'] as const;
const ALIAS_KEYS = new Set<string>([...CONSUMPTION_KEYS, ...WORK_FACTOR_KEYS]);

function firstDefined(
  attributes: Record<string, number>,
  keys: readonly string[],
): number | undefined {
  for (const key of keys) {
    const value = attributes[key];
    if (value !== undefined && Number.isFinite(value)) return value;
  }
  return undefined;
}

/**
 * Yhdistää suomi/englanti-aliakset. work_factor voittaa tyokerroin-avaimen,
 * jotta editorin arvo on sama kuin kaavakontekstin kaytettava_maali.tyokerroin.
 */
export function canonicalizeProductAttributes(
  raw?: Record<string, number>,
): Record<string, number> | undefined {
  if (!raw) return undefined;
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (STRIPPED_ATTRIBUTES.has(key) || ALIAS_KEYS.has(key)) continue;
    if (!Number.isFinite(value)) continue;
    next[key] = value;
  }
  const consumption = firstDefined(raw, CONSUMPTION_KEYS);
  const workFactor = firstDefined(raw, WORK_FACTOR_KEYS);
  if (consumption !== undefined) next.consumption = consumption;
  if (workFactor !== undefined) next.work_factor = workFactor;
  return Object.keys(next).length > 0 ? next : undefined;
}

export function parseProductAttributesJson(raw: string | null | undefined): Record<string, number> | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const attributes: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (STRIPPED_ATTRIBUTES.has(key)) continue;
      if (typeof value === 'number' && Number.isFinite(value)) {
        attributes[key] = value;
      } else if (typeof value === 'string') {
        const parsed = parseNumber(value);
        if (parsed !== null) attributes[key] = parsed;
      }
    }
    return canonicalizeProductAttributes(attributes);
  } catch {
    return undefined;
  }
}

export function buildProductAttributes(
  consumption: string,
  workFactor: string,
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
  return Object.keys(attributes).length > 0 ? attributes : undefined;
}

export function attributeFieldValues(attributes?: Record<string, number>): {
  consumption: string;
  workFactor: string;
} {
  const canonical = canonicalizeProductAttributes(attributes);
  return {
    consumption: canonical?.consumption !== undefined ? String(canonical.consumption) : '',
    workFactor: canonical?.work_factor !== undefined ? String(canonical.work_factor) : '',
  };
}

/** Valitun tuotteen työkerroin kaavoissa; puuttuva arvo on 1 (ei kerrointa). */
export function productWorkFactor(attributes?: Record<string, number>): number {
  return canonicalizeProductAttributes(attributes)?.work_factor ?? 1;
}

export function productConsumption(attributes?: Record<string, number>): number | undefined {
  return canonicalizeProductAttributes(attributes)?.consumption;
}
