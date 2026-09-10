import type { CalculationResult } from '@/src/core/calculation/calculationPipeline';
import {
  buildCalculationFormulaContext,
  parseTravelTimeHoursOneWay,
} from '@/src/core/form/calculationFormulaContext';
import { previewFormContext } from '@/src/core/calculation/calculationPipeline';
import { buildFormSnapshot, hasSummarySnapshotFields } from '@/src/core/form/formSummaryHelpers';
import type { FormDefinition } from '@/src/core/form/types';
import type {
  AppSettings,
  CalculationLine,
  CalculationRecord,
  CustomerInfo,
  Product,
  StructureLine,
  WizardDraft,
  WizardLineDraft,
} from '@/src/core/models/types';
import { serializeCustomerDetails } from '@/src/core/models/types';
import { productBelongsToStructure } from '@/src/core/product/productStructures';
import { aggregateStructureLines, withDerivedLinePricing } from '@/src/core/structure/linePricing';
import type { ProductStructure } from '@/src/core/structure/types';

export type BuildCalculationRecordInput = {
  id: string;
  draft: WizardDraft;
  result: CalculationResult;
  settings: AppSettings;
  fieldValues: Record<string, string>;
  formDefinition: FormDefinition;
  formContext: Record<string, number>;
  materialLines: WizardLineDraft[];
  products: Product[];
  createdAt: Date;
  createLineId: () => string;
};

function realizedMarginPercent(result: CalculationResult): number {
  const sellingBase =
    result.contractPriceVat0 + result.materialsVat0 + result.marginEur + result.commissionEur;
  if (!(sellingBase > 0)) return 0;
  return (result.marginEur / sellingBase) * 100;
}

/** Muuntaa wizard-laskennan tallennettavaksi CalculationRecordiksi. */
export function buildCalculationRecord(input: BuildCalculationRecordInput): CalculationRecord {
  const {
    id,
    draft,
    result,
    settings,
    fieldValues,
    formDefinition,
    formContext,
    materialLines,
    products,
    createdAt,
    createLineId,
  } = input;

  const formSnapshot = buildFormSnapshot(formDefinition, fieldValues, formContext, products);
  const groupDurationHours =
    draft.groupDurationHours ?? result.workDurationDays * settings.workdayHours;

  return {
    id,
    projectName: draft.customer.name,
    customer: serializeCustomerDetails(draft.customer),
    groupDurationHours,
    crewSize: draft.crewSize ?? settings.defaultCrewSize,
    hourlyRate: settings.defaultHourlyRate,
    marginPercent: realizedMarginPercent(result),
    commissionPercent: settings.defaultCommissionPercent,
    contractPriceVat0: result.contractPriceVat0,
    materialsVat0: result.materialsVat0,
    marginEur: result.marginEur,
    commissionEur: result.commissionEur,
    totalPriceVat0: result.totalPriceVat0,
    vatPercent: settings.vatPercent,
    vatAmount: result.vatAmount,
    totalPriceVat: result.totalPriceVat,
    workDurationDays: result.workDurationDays,
    discountPercent: result.discountPercent,
    discountEur: result.discountEur,
    totalPriceVatBeforeDiscount: result.totalPriceVatBeforeDiscount,
    totalPriceVat0BeforeDiscount: result.totalPriceVat0BeforeDiscount,
    createdAt,
    formSnapshot,
    lines: materialLines.map(
      (line): CalculationLine => ({
        id: createLineId(),
        productId: line.product.id,
        productName: line.product.name,
        unit: line.product.unit,
        unitPriceVat0: line.product.unitPriceVat0,
        quantity: line.quantity,
        lineTotalVat0: line.quantity * line.product.unitPriceVat0,
      }),
    ),
  };
}

export type BuildComposerRecordInput = {
  id: string;
  customer: CustomerInfo;
  customerId?: string;
  deliveryScheduleText?: string;
  travelTimeOneWay?: string;
  structureLines: StructureLine[];
  settings: AppSettings;
  products: Product[];
  structures: ProductStructure[];
  createdAt: Date;
};

/** Tallentaa laskelman tuoterakenneriveistä. */
export function buildCalculationRecordFromComposer(
  input: BuildComposerRecordInput,
): CalculationRecord {
  const structureLines = input.structureLines.map((line) =>
    withLineFormSnapshot(withDerivedLinePricing(line), input),
  );
  const reverseVat = Boolean(input.customer.reverseVat);
  const totals = aggregateStructureLines(
    structureLines,
    input.settings.vatPercent,
    reverseVat,
  );
  const firstFilled = structureLines.find(
    (line) => hasSummarySnapshotFields(line.snapshot) || line.formFilled,
  );

  return {
    id: input.id,
    projectName: input.customer.name.trim(),
    customer: serializeCustomerDetails(input.customer),
    customerId: input.customerId,
    deliveryScheduleText: input.deliveryScheduleText?.trim() || undefined,
    travelTimeHoursOneWay: parseTravelTimeHoursOneWay(input.travelTimeOneWay) || undefined,
    groupDurationHours: 0,
    crewSize: input.settings.defaultCrewSize,
    hourlyRate: input.settings.defaultHourlyRate,
    marginPercent: totals.marginPercent,
    commissionPercent: 0,
    contractPriceVat0: totals.contractPriceVat0,
    materialsVat0: totals.materialsVat0,
    marginEur: totals.marginEur,
    commissionEur: totals.commissionEur,
    totalPriceVat0: totals.totalPriceVat0,
    vatPercent: input.settings.vatPercent,
    vatAmount: totals.vatAmount,
    totalPriceVat: totals.totalPriceVat,
    workDurationDays: 0,
    discountPercent: totals.discountPercent,
    discountEur: totals.discountEur,
    totalPriceVatBeforeDiscount: totals.totalPriceVatBeforeDiscount,
    totalPriceVat0BeforeDiscount: totals.totalPriceVat0BeforeDiscount,
    createdAt: input.createdAt,
    formSnapshot: firstFilled?.snapshot,
    structureLines,
    lines: [],
  };
}

function withLineFormSnapshot(
  line: StructureLine,
  input: Pick<
    BuildComposerRecordInput,
    'structures' | 'products' | 'settings' | 'customer' | 'travelTimeOneWay'
  >,
): StructureLine {
  if (hasSummarySnapshotFields(line.snapshot)) return line;
  const structure = input.structures.find((item) => item.id === line.structureId);
  if (!structure) return line;
  const hasValues = Object.values(line.fieldValues ?? {}).some((value) => value.trim().length > 0);
  if (!hasValues && !line.formFilled) return line;
  const structureProducts = input.products.filter((product) =>
    productBelongsToStructure(product, line.structureId),
  );
  const context = previewFormContext(
    structure.form,
    line.fieldValues ?? {},
    [],
    structureProducts,
    input.settings,
    undefined,
    Boolean(input.customer.reverseVat),
    buildCalculationFormulaContext({ travelTimeHoursOneWay: input.travelTimeOneWay }),
  );
  return {
    ...line,
    snapshot: buildFormSnapshot(
      structure.form,
      line.fieldValues ?? {},
      context,
      structureProducts,
    ),
  };
}
