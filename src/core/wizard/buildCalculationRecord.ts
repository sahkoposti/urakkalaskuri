import type { CalculationResult } from '@/src/core/calculation/calculationPipeline';
import { buildFormSnapshot } from '@/src/core/form/formSummaryHelpers';
import type { FormDefinition } from '@/src/core/form/types';
import type {
  AppSettings,
  CalculationLine,
  CalculationRecord,
  Product,
  WizardDraft,
  WizardLineDraft,
} from '@/src/core/models/types';
import { serializeCustomerDetails } from '@/src/core/models/types';

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
