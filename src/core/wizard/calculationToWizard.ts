import type { FieldValue } from '@/src/core/form/types';
import { DURATION_DAYS_KEY } from '@/src/core/form/types';
import type { CalculationRecord, Product, WizardDraft, WizardLineDraft } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import type { WizardFormState } from '@/src/core/wizard/wizardDraftHelpers';
import { hydrateWizardLines } from '@/src/core/wizard/wizardDraftHelpers';

export function calculationToFormState(
  record: CalculationRecord,
  products: Product[],
  currentForm?: { id: string; updatedAt: number },
): { form: WizardFormState; wizardDraft: WizardDraft; formStale: boolean } {
  const customer = customerFromRecord(record);
  const snapshot = record.formSnapshot;
  const extraLines = snapshot?.extraLines ??
    record.lines.map((line) => ({
      productId: line.productId ?? line.id,
      quantity: line.quantity,
    }));
  const hydrated = hydrateWizardLines(extraLines, products);
  const lines: WizardLineDraft[] =
    hydrated.length > 0 || snapshot
      ? hydrated
      : record.lines.map((line) => {
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

  const fieldValues: Record<string, FieldValue> = {
    ...((snapshot?.fieldValues as Record<string, FieldValue> | undefined) ?? {}),
  };
  if (fieldValues[DURATION_DAYS_KEY] == null) {
    fieldValues[DURATION_DAYS_KEY] = record.workDurationDays;
  }

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
    fieldValues,
  };

  const wizardDraft: WizardDraft = {
    customer,
    groupDurationHours: record.groupDurationHours,
    crewSize: record.crewSize,
    marginPercent: record.marginPercent,
    commissionPercent: record.commissionPercent,
    lines,
  };

  const formStale = Boolean(
    snapshot &&
      currentForm &&
      (snapshot.formId !== currentForm.id || snapshot.formUpdatedAt !== currentForm.updatedAt),
  );

  return { form, wizardDraft, formStale };
}
