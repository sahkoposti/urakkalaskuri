import type { CalculationResult } from '@/src/core/calculation/calculationPipeline';
import type { FormSnapshot, StructureLine, StructureLineOverride } from '@/src/core/models/types';
import { withDerivedLinePricing } from '@/src/core/structure/linePricing';
import { normalizeDisplayWorkDurationDays } from '@/src/core/structure/workDurationDisplay';
import { roundToCents } from '@/src/core/utils/formatters';

export function applyFormResultToLine(
  line: StructureLine,
  result: CalculationResult,
  fieldValues: Record<string, string>,
  commissionPercent: number,
  extras?: { formVersion?: number; snapshot?: FormSnapshot },
): StructureLine {
  const overrides = new Set(line.overrides);
  return withDerivedLinePricing({
    ...line,
    fieldValues,
    formFilled: true,
    formVersion: extras?.formVersion,
    snapshot: extras?.snapshot,
    unitPriceVat0: overrides.has('unitPrice')
      ? line.unitPriceVat0
      : roundToCents(result.totalPriceVat0BeforeDiscount),
    materialsVat0: overrides.has('materials')
      ? line.materialsVat0
      : roundToCents(result.materialsVat0),
    discountPercent: overrides.has('discount')
      ? line.discountPercent
      : roundToCents(result.discountPercent),
    contractPriceVat0: overrides.has('contractPrice')
      ? line.contractPriceVat0
      : roundToCents(result.contractPriceVat0),
    workDurationDays: result.workDurationDays,
    commissionPercent,
  });
}

export function patchStructureLine(
  line: StructureLine,
  patch: Partial<
    Pick<
      StructureLine,
      | 'quantity'
      | 'unit'
      | 'unitPriceVat0'
      | 'materialsVat0'
      | 'discountPercent'
      | 'name'
      | 'pricesIncludeVat'
      | 'additionalInfo'
      | 'contractPriceVat0'
    >
  > & { displayWorkDurationDays?: number | null },
): StructureLine {
  const overrides = new Set<StructureLineOverride>(line.overrides);
  if (patch.quantity !== undefined) overrides.add('quantity');
  if (patch.unit !== undefined) overrides.add('unit');
  if (patch.unitPriceVat0 !== undefined) overrides.add('unitPrice');
  if (patch.materialsVat0 !== undefined) overrides.add('materials');
  if (patch.discountPercent !== undefined) overrides.add('discount');
  if (patch.contractPriceVat0 !== undefined) overrides.add('contractPrice');
  let displayWorkDurationDays = line.displayWorkDurationDays;
  if (patch.displayWorkDurationDays !== undefined) {
    const normalized = normalizeDisplayWorkDurationDays(patch.displayWorkDurationDays);
    if (normalized == null) {
      overrides.delete('workDurationDisplay');
      displayWorkDurationDays = undefined;
    } else {
      overrides.add('workDurationDisplay');
      displayWorkDurationDays = normalized;
    }
  }
  const additionalInfo =
    patch.additionalInfo === undefined ? undefined : patch.additionalInfo.trim() || undefined;
  const rounded = {
    ...patch,
    ...(patch.quantity !== undefined ? { quantity: roundToCents(patch.quantity) } : {}),
    ...(patch.unitPriceVat0 !== undefined
      ? { unitPriceVat0: roundToCents(patch.unitPriceVat0) }
      : {}),
    ...(patch.materialsVat0 !== undefined
      ? { materialsVat0: roundToCents(patch.materialsVat0) }
      : {}),
    ...(patch.discountPercent !== undefined
      ? { discountPercent: roundToCents(patch.discountPercent) }
      : {}),
    ...(patch.contractPriceVat0 !== undefined
      ? { contractPriceVat0: roundToCents(patch.contractPriceVat0) }
      : {}),
    ...(patch.additionalInfo !== undefined ? { additionalInfo } : {}),
    displayWorkDurationDays,
  };
  return withDerivedLinePricing({
    ...line,
    ...rounded,
    overrides: [...overrides],
  });
}

export function saveIncompleteFormToLine(
  line: StructureLine,
  fieldValues: Record<string, string>,
): StructureLine {
  return {
    ...line,
    fieldValues: { ...fieldValues },
    formFilled: false,
  };
}
