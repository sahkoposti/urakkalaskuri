import type { CalculationRecord, Product, WizardDraft, WizardLineDraft } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import type { WizardFormState } from '@/src/core/wizard/wizardDraftHelpers';

export function calculationToFormState(
  record: CalculationRecord,
  products: Product[],
): { form: WizardFormState; wizardDraft: WizardDraft } {
  const customer = customerFromRecord(record);
  const lines: WizardLineDraft[] = record.lines
    .map((line) => {
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

  const form: WizardFormState = {
    step: 0,
    customerName: customer.name,
    customerType: customer.customerType ?? 'private',
    reverseVat: customer.reverseVat ?? false,
    customerPhone: customer.phone ?? '',
    customerEmail: customer.email ?? '',
    customerAddress: customer.address ?? '',
    customerNotes: customer.notes ?? '',
    duration: String(record.workDurationDays).replace('.', ','),
    lines,
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
