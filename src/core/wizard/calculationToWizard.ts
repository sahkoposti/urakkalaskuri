import { resolveTravelTimeHours } from '@/src/core/form/calculationFormulaContext';
import type { CalculationRecord, Product, WizardDraft, WizardLineDraft } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import { ensureStructureLines } from '@/src/core/structure/legacyCalculation';
import type { WizardFormState } from '@/src/core/wizard/wizardDraftHelpers';

/** Palauttaa tallennetun laskelman wizard-tilaksi (asiakas, rivit, fieldValues). */
export function calculationToFormState(
  record: CalculationRecord,
  products: Product[],
): { form: WizardFormState; wizardDraft: WizardDraft } {
  const customer = customerFromRecord(record);
  const lines: WizardLineDraft[] = record.lines.map((line) => {
    const product =
      (line.productId ? products.find((item) => item.id === line.productId) : null) ??
      ({
        id: line.productId ?? line.id,
        name: line.productName,
        unit: line.unit,
        unitPriceVat0: line.unitPriceVat0,
        createdAt: record.createdAt,
      } satisfies Product);
    return { product, quantity: line.quantity };
  });

  const duration = String(record.workDurationDays).replace('.', ',');
  const snapshotValues = record.formSnapshot?.fieldValues ?? {};
  const fieldValues: Record<string, string> = { ...snapshotValues };

  // Varmista kesto sekä fieldValuesissä että legacy duration-kentässä
  if (!fieldValues.tyoryhma_kesto_pv?.trim()) {
    fieldValues.tyoryhma_kesto_pv = duration;
  }

  const form: WizardFormState = {
    step: 0,
    customerName: customer.name,
    customerType: customer.customerType ?? 'private',
    reverseVat: customer.reverseVat ?? false,
    customerPhone: customer.phone ?? '',
    customerEmail: customer.email ?? '',
    customerAddress: customer.address ?? '',
    customerPostalCode: customer.postalCode ?? '',
    customerPostalLocality: customer.postalLocality ?? '',
    customerNotes: customer.notes ?? '',
    duration: fieldValues.tyoryhma_kesto_pv || duration,
    fieldValues,
    lines,
    customerId: record.customerId,
    deliveryScheduleText: record.deliveryScheduleText ?? '',
    travelTimeHours: resolveTravelTimeHours({
      travelTimeHours: record.travelTimeHours,
      fieldValues: fieldValues,
      structureLines: record.structureLines,
    }),
    structureLines: ensureStructureLines(record),
  };

  const wizardDraft: WizardDraft = {
    customer,
    groupDurationHours: record.groupDurationHours,
    crewSize: record.crewSize,
    marginPercent: record.marginPercent,
    commissionPercent: record.commissionPercent,
    lines,
  };

  return { form, wizardDraft };
}
