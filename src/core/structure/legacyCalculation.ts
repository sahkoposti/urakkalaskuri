import type { CalculationRecord, StructureLine } from '@/src/core/models/types';
import { withDerivedLinePricing } from '@/src/core/structure/linePricing';
import { DEFAULT_STRUCTURE_ID } from '@/src/core/structure/types';

export function structureLineFromLegacyRecord(
  record: Pick<
    CalculationRecord,
    | 'id'
    | 'contractPriceVat0'
    | 'materialsVat0'
    | 'discountPercent'
    | 'vatPercent'
    | 'workDurationDays'
    | 'commissionPercent'
    | 'commissionEur'
    | 'marginEur'
    | 'marginPercent'
    | 'totalPriceVat0BeforeDiscount'
    | 'formSnapshot'
  >,
  structureName = 'Laskenta',
  structureId = DEFAULT_STRUCTURE_ID,
): StructureLine {
  const snapshot = record.formSnapshot;
  const hasForm = typeof snapshot?.formId === 'string' && snapshot.formId.length > 0;
  return withDerivedLinePricing({
    id: `${record.id}_line`,
    structureId,
    name: structureName,
    quantity: 1,
    unitPriceVat0: record.totalPriceVat0BeforeDiscount,
    materialsVat0: record.materialsVat0,
    discountPercent: record.discountPercent,
    vatPercent: record.vatPercent,
    contractPriceVat0: record.contractPriceVat0,
    workDurationDays: record.workDurationDays,
    commissionPercent: record.commissionPercent,
    commissionEur: record.commissionEur,
    marginEur: record.marginEur,
    marginPercent: record.marginPercent,
    fieldValues: snapshot?.fieldValues ?? {},
    formFilled: hasForm,
    formVersion: hasForm ? snapshot?.formVersion : undefined,
    snapshot,
    overrides: [],
  });
}

export function ensureStructureLines(
  record: CalculationRecord,
  structureName = 'Laskenta',
): StructureLine[] {
  if (record.structureLines && record.structureLines.length > 0) {
    return record.structureLines.map(withDerivedLinePricing);
  }
  return [structureLineFromLegacyRecord(record, structureName)];
}
